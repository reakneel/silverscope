-- Persisted source and data-quality monitoring snapshots; server/service-role only.
create table if not exists public.source_health_checks (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.data_sources(id),
  checked_at timestamptz not null default now(),
  status text not null check (status in ('disabled','blocked','never_succeeded','healthy','delayed','stale','failed','degraded')),
  age_ms bigint,
  expected_interval_ms bigint,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_run_status public.ingestion_status,
  alerts jsonb not null default '[]'::jsonb
);
create index if not exists source_health_checks_source_time_idx
  on public.source_health_checks (source_id, checked_at desc);

create table if not exists public.source_health_alerts (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.source_health_checks(id) on delete cascade,
  source_id text not null references public.data_sources(id),
  severity text not null check (severity in ('info','warning','critical')),
  code text not null,
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (check_id, code)
);
create index if not exists source_health_alerts_open_idx
  on public.source_health_alerts (created_at desc) where acknowledged_at is null;

create table if not exists public.data_quality_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  window_start timestamptz not null,
  status text not null check (status in ('healthy','degraded','insufficient_data')),
  observation_count bigint not null default 0,
  missing_published_at_count bigint not null default 0,
  non_verified_count bigint not null default 0,
  fetched_count bigint not null default 0,
  accepted_count bigint not null default 0,
  rejected_count bigint not null default 0,
  rejected_ratio numeric(8,6),
  publication_timestamp_coverage numeric(8,6),
  metrics jsonb not null default '{}'::jsonb
);
create index if not exists data_quality_checks_time_idx
  on public.data_quality_checks (checked_at desc);

alter table public.source_health_checks enable row level security;
alter table public.source_health_alerts enable row level security;
alter table public.data_quality_checks enable row level security;
revoke all on public.source_health_checks, public.source_health_alerts, public.data_quality_checks from anon, authenticated;
grant select, insert on public.source_health_checks, public.source_health_alerts, public.data_quality_checks to service_role;

-- CFTC Disaggregated Futures Only data is a public government dataset.
update public.data_sources set license_status = 'public_api', updated_at = now() where id = 'cftc';
grant select on public.observations, public.observation_archive to service_role;
