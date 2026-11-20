# Architecture

## Application
Next.js App Router serves marketing, dashboard and API routes. Server-side authorization must protect premium data and actions; hiding UI controls is not access control.

## Planned services
- Supabase Postgres: users, plans, observations, indicators, scores, signals, alerts and audit events.
- Ingestion workers: scheduled source adapters with retries, idempotency and provenance.
- Quant service: deterministic feature calculation, scoring, signal generation and backtesting. Python is preferred for research workflows.
- Stripe: subscription lifecycle and webhook-driven entitlement updates.
- Vercel: web deployment and suitable lightweight scheduled tasks. Long-running ingestion/backtests should use a worker platform rather than relying on request duration.

## Data flow
Source adapters -> raw observations -> validation/normalization -> derived indicators -> model score -> signal snapshot -> dashboard/API/alerts.

## Data integrity
Keep raw source records immutable. Store units and timestamps explicitly. Never overwrite missing or stale data with a plausible-looking number. Track model_version and input snapshot for every generated score.

## Security
- Keep service-role and payment secrets server-side.
- Validate webhook signatures.
- Enforce row-level security where appropriate.
- Rate-limit public APIs and protect admin operations.
- Log privileged changes and entitlement transitions.
