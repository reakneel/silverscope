# SilverScope

SilverScope is a silver-market intelligence and quantitative research SaaS. It organizes inventory, macro, supply-demand and positioning evidence into transparent market context, indicators and research signals.

> **Current status:** The MVP, versioned scoring core, data-quality pipeline, FRED and CFTC adapters, protected ingestion routes, calibration-gated scoring pipeline and Supabase migrations are implemented. Production credentials have not been configured, so no live observations are being ingested or displayed. Authentication, billing and alert delivery are not connected.

## Stack
- Next.js App Router + TypeScript + React 19
- Deterministic TypeScript scoring, normalization and data-quality core
- FRED macro adapter: DFII10, DTWEXBGS and DGS10 (API key required)
- CFTC Disaggregated Futures Only adapter for COMEX standard Silver managed-money net positions
- Supabase Postgres schema, RLS and server-side REST persistence (requires project credentials)
- Planned: licensed COMEX/LBMA/spot feeds, Python research/backtesting workers, Stripe

## Run locally
```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```
Open http://localhost:3000.

## Routes
- / — Market overview
- /signals — Signal methodology and evidence placeholders
- /indicators — Indicator catalogue
- /pricing — Proposed tiers (checkout disabled)
- /api/health — Application configuration status
- /api/cron/ingest/fred — Protected FRED macro ingestion endpoint
- /api/cron/ingest/cftc — Protected CFTC Silver positioning ingestion endpoint
- /api/cron/score — Protected calibration-gated score and signal snapshot endpoint

## Data and quant core
- lib/data/contracts.ts — observation and feature contracts
- lib/data/quality.ts — timestamp, confidence, freshness and status validation
- lib/data/source-registry.ts — candidate sources and activation metadata
- lib/ingestion/fred-adapter.ts — DFII10, DTWEXBGS and DGS10
- lib/ingestion/cftc-adapter.ts — CFTC Disaggregated Futures Only, standard COMEX Silver contract 084691
- lib/ingestion/runner.ts — adapter execution and validation
- lib/ingestion/supabase-rest.ts — idempotent server-side observation persistence
- lib/quant/engine.ts — versioned, coverage-aware composite scoring
- lib/quant/features.ts — calibrated raw-observation to normalized-feature conversion
- lib/quant/signals.ts — evidence-backed regime snapshot generation
- lib/quant/supabase-pipeline.ts — historical observation retrieval and idempotent score persistence
- supabase/migrations/ — relational schema, seeds, RLS and snapshot idempotency

The score engine accepts normalized feature scores, not raw market values in incompatible units. It withholds output when minimum coverage, group count or confidence requirements are not met. Empirical calibration is required; the endpoint will not manufacture calibration values.

## Environment
Copy .env.example to .env.local. FRED ingestion requires FRED_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET. CFTC ingestion requires the Supabase URL, service-role key and CRON_SECRET. Scoring additionally requires SILVER_FEATURE_CALIBRATION_JSON estimated from documented historical data. Never expose the service-role key to a browser. The health endpoint reports configuration presence only; it does not validate credentials or imply that feeds are live.

## Data integrity
Every production observation preserves source, observed/published/fetched timestamps, unit, status and confidence. FRED and CFTC report APIs do not provide an exact publication timestamp in the observation payload used here, so published_at is left null. Raw observations are deduplicated and never silently overwritten with guessed values. CFTC positioning is Tuesday-as-of data, not Friday publication-time data.

## Documentation
See docs/ARCHITECTURE.md, docs/DATA_SOURCES.md, docs/INGESTION.md, docs/QUANT_MODEL.md, docs/SUPABASE.md and docs/TODO.md.

## Disclaimer
SilverScope is intended as a general market research and information tool. It is not personalized investment advice, a solicitation, or a guarantee of trading outcomes. Regulatory review is required before offering paid signals or strategy features in any target jurisdiction.
