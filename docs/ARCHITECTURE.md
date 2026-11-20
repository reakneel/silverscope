# Architecture

## Application
Next.js App Router serves the dashboard and API routes. Server-side authorization must protect premium data and actions; hiding UI controls is not access control.

## Implemented foundation
- Typed observation and feature contracts with freshness, confidence and timestamp validation.
- Versioned TypeScript composite scoring with component weights, coverage gating and explicit rejected-input reasons.
- FRED macro adapter for DFII10, DTWEXBGS and DGS10.
- Protected server-side ingestion endpoint and Supabase REST persistence with deterministic observation deduplication.
- Supabase schema for profiles, source registry, ingestion runs, observations, indicators, model versions, scores, signals, subscriptions, alerts and audit events.

## Planned services
- Supabase Postgres/Auth: database and user identity (schema prepared; live project not yet provisioned).
- Additional ingestion adapters: CFTC, COMEX, LBMA and a verified silver spot feed.
- Quant research workers: feature engineering, scoring, backtesting and historical snapshots. Python is preferred for research workflows.
- Stripe: subscription lifecycle and webhook-driven entitlement updates.
- Vercel: web deployment and suitable lightweight scheduled tasks. Long-running ingestion/backtests should use a worker platform rather than relying on request duration.

## Data flow
Source adapters -> raw observations -> validation/normalization -> derived indicators -> model score -> signal snapshot -> dashboard/API/alerts.

## Data integrity
Keep raw source records immutable. Store units and timestamps explicitly. Never overwrite missing or stale data with a plausible-looking number. Track model_version and exact input snapshot for every generated score. Do not treat a macro proxy as a silver spot price.

## Security
- Keep service-role and payment secrets server-side.
- Protect ingestion with a dedicated CRON_SECRET and authorization header.
- Validate webhook signatures.
- Enforce row-level security where appropriate.
- Rate-limit public APIs and protect admin operations.
- Log privileged changes and entitlement transitions.
