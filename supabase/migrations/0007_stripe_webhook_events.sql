-- Stripe webhook idempotency ledger. No client-facing RLS policies: service-role only.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null check (status in ('processing','processed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_summary text
);
create index if not exists stripe_webhook_events_status_received_idx on public.stripe_webhook_events (status, received_at desc);
alter table public.stripe_webhook_events enable row level security;
