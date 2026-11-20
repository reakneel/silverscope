-- Immutable research experiment manifests and point-in-time run snapshots.
create table if not exists public.research_experiments (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  hypothesis text not null,
  strategy_version text not null,
  model_version text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner_id, manifest_sha256)
);
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  experiment_id text not null references public.research_experiments(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  dataset_id text not null,
  decision_time timestamptz not null,
  strategy_version text not null,
  model_version text not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  parameters jsonb not null,
  assumptions jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner_id, snapshot_sha256)
);
create index if not exists research_runs_experiment_created_idx on public.research_runs (experiment_id, created_at desc);
create index if not exists research_runs_decision_time_idx on public.research_runs (decision_time desc);
create table if not exists public.research_run_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  artifact_kind text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, artifact_kind, artifact_sha256)
);
create index if not exists research_run_artifacts_run_idx on public.research_run_artifacts (run_id, created_at);

alter table public.research_experiments enable row level security;
alter table public.research_runs enable row level security;
alter table public.research_run_artifacts enable row level security;

create policy "Owners read research experiments" on public.research_experiments
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners create research experiments" on public.research_experiments
  for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners read research runs" on public.research_runs
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners create research runs" on public.research_runs
  for insert to authenticated with check (
    owner_id = auth.uid() and exists (
      select 1 from public.research_experiments e
      where e.id = experiment_id and e.owner_id = auth.uid()
    )
  );
create policy "Owners read research artifacts" on public.research_run_artifacts
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners create research artifacts" on public.research_run_artifacts
  for insert to authenticated with check (
    owner_id = auth.uid() and exists (
      select 1 from public.research_runs r
      where r.id = run_id and r.owner_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies are defined: manifests, runs and artifacts are append-only.
-- Service-role ingestion / persistence must remain server-side and must not be exposed to clients.
