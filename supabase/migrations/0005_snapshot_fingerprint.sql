-- Stable input fingerprint makes retries idempotent even when the job runs at different wall-clock times.
alter table public.scores add column if not exists snapshot_key text;
alter table public.signals add column if not exists snapshot_key text;
drop index if exists public.scores_model_asof_uidx;
drop index if exists public.signals_model_key_generated_uidx;
create unique index if not exists scores_model_snapshot_uidx
  on public.scores (model_version_id, snapshot_key);
create unique index if not exists signals_model_key_snapshot_uidx
  on public.signals (model_version_id, signal_key, snapshot_key);
