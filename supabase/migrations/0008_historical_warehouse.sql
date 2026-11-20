-- Historical warehouse: retain complete observation history while moving older rows
-- out of the hot ingestion table into monthly partitions. No historical data is deleted.
create table if not exists public.observation_archive (
  id uuid not null,
  source_id text not null references public.data_sources(id),
  indicator_key text not null,
  value numeric not null,
  unit text not null,
  observed_at timestamptz not null,
  published_at timestamptz,
  fetched_at timestamptz not null,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  status public.data_status not null,
  source_url text,
  source_record_id text,
  dedupe_key text not null,
  quality_flags jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  primary key (id, observed_at),
  unique (dedupe_key, observed_at)
) partition by range (observed_at);

create index if not exists observation_archive_indicator_time_idx
  on public.observation_archive (indicator_key, observed_at desc);
create index if not exists observation_archive_source_time_idx
  on public.observation_archive (source_id, observed_at desc);

create or replace function public.ensure_observation_archive_partition(p_month date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  partition_name text := 'observation_archive_' || to_char(month_start, 'YYYY_MM');
begin
  execute format(
    'create table if not exists public.%I partition of public.observation_archive for values from (%L) to (%L)',
    partition_name, month_start, month_end
  );
end;
$$;

create or replace function public.archive_old_observations(
  p_before timestamptz,
  p_batch_size integer default 5000,
  p_max_batches integer default 20
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_min timestamptz;
  v_max timestamptz;
  v_month date;
  v_last_month date;
  v_moved bigint := 0;
  v_batch bigint := 0;
  v_candidates bigint := 0;
  v_iteration integer;
begin
  perform pg_advisory_xact_lock(hashtext('silverscope:archive_old_observations'));
  if p_before is null then raise exception 'p_before is required'; end if;
  if p_batch_size < 1 or p_batch_size > 20000 then raise exception 'p_batch_size must be between 1 and 20000'; end if;
  if p_max_batches < 1 or p_max_batches > 100 then raise exception 'p_max_batches must be between 1 and 100'; end if;

  for v_iteration in 1..p_max_batches loop
    select min(batch.observed_at), max(batch.observed_at)
      into v_min, v_max
    from (
      select observed_at
      from public.observations
      where observed_at < p_before
      order by observed_at asc, id asc
      limit p_batch_size
    ) batch;

    exit when v_min is null;
    v_month := date_trunc('month', v_min)::date;
    v_last_month := date_trunc('month', v_max)::date;
    while v_month <= v_last_month loop
      perform public.ensure_observation_archive_partition(v_month);
      v_month := (v_month + interval '1 month')::date;
    end loop;

    with candidates as materialized (
      select *
      from public.observations
      where observed_at < p_before
      order by observed_at asc, id asc
      limit p_batch_size
      for update skip locked
    ),
    inserted as (
      insert into public.observation_archive (
        id, source_id, indicator_key, value, unit, observed_at, published_at,
        fetched_at, confidence, status, source_url, source_record_id, dedupe_key,
        quality_flags, raw_payload, created_at
      )
      select id, source_id, indicator_key, value, unit, observed_at, published_at,
        fetched_at, confidence, status, source_url, source_record_id, dedupe_key,
        quality_flags, raw_payload, created_at
      from candidates
      on conflict (dedupe_key, observed_at) do nothing
      returning id, dedupe_key, observed_at
    ),
    verified as (
      select c.id
      from candidates c
      join inserted i on i.dedupe_key = c.dedupe_key and i.observed_at = c.observed_at
      union all
      select c.id
      from candidates c
      join public.observation_archive a
        on a.dedupe_key = c.dedupe_key and a.observed_at = c.observed_at
      where row(
        a.id, a.source_id, a.indicator_key, a.value, a.unit, a.observed_at,
        a.published_at, a.fetched_at, a.confidence, a.status, a.source_url,
        a.source_record_id, a.dedupe_key, a.quality_flags, a.raw_payload, a.created_at
      ) is not distinct from row(
        c.id, c.source_id, c.indicator_key, c.value, c.unit, c.observed_at,
        c.published_at, c.fetched_at, c.confidence, c.status, c.source_url,
        c.source_record_id, c.dedupe_key, c.quality_flags, c.raw_payload, c.created_at
      )
      and not exists (
        select 1 from inserted i
        where i.dedupe_key = c.dedupe_key and i.observed_at = c.observed_at
      )
    ),
    deleted as (
      delete from public.observations o
      using verified v
      where o.id = v.id
      returning o.id
    )
    select (select count(*) from candidates), (select count(*) from deleted)
      into v_candidates, v_batch;

    if v_batch <> v_candidates then
      raise exception 'Archive verification failed: % candidate rows, % safely archived and deleted. Source rows were retained by transaction rollback.',
        v_candidates, v_batch;
    end if;
    v_moved := v_moved + v_batch;
    exit when v_batch = 0;
  end loop;
  return v_moved;
end;
$$;

alter table public.observation_archive enable row level security;
revoke all on public.observation_archive from anon, authenticated;
revoke all on function public.ensure_observation_archive_partition(date) from public, anon, authenticated;
revoke all on function public.archive_old_observations(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.archive_old_observations(timestamptz, integer, integer) to service_role;

create or replace view public.observation_history
with (security_invoker = true)
as
select id, source_id, indicator_key, value, unit, observed_at, published_at, fetched_at,
  confidence, status, source_url, source_record_id, dedupe_key, quality_flags, raw_payload, created_at
from public.observations
union all
select id, source_id, indicator_key, value, unit, observed_at, published_at, fetched_at,
  confidence, status, source_url, source_record_id, dedupe_key, quality_flags, raw_payload, created_at
from public.observation_archive;

grant select on public.observation_history to service_role;
