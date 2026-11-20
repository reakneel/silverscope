-- Make scheduled score/signal generation safe to retry.
create unique index if not exists scores_model_asof_uidx
  on public.scores (model_version_id, as_of);
create unique index if not exists signals_model_key_generated_uidx
  on public.signals (model_version_id, signal_key, generated_at);
