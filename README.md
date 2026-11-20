# SilverScope

SilverScope is a silver-market intelligence and quantitative research SaaS. It organizes inventory, macro, supply-demand and positioning evidence into transparent market context, indicators and research signals.

> **Current status:** The MVP, versioned scoring core, data-quality pipeline, FRED macro adapter and protected Supabase ingestion path are implemented. The production environment does not yet have Supabase or FRED credentials, so no live observations are being ingested or displayed. Authentication, billing and alert delivery are not connected.

## Stack
- Next.js App Router + TypeScript + React 19
- Deterministic TypeScript scoring and data-quality core
- FRED macro series adapter (requires API key)
- Supabase Postgres/Auth schema and server-side REST persistence (requires project credentials)
- Planned: licensed silver spot / COMEX / LBMA feeds, Python research/backtesting workers, Stripe

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Routes
- / — Market overview
- /signals — Signal methodology and evidence placeholders
- /indicators — Indicator catalogue
- /pricing — Proposed tiers (checkout disabled)
- /api/health — Application configuration status
- /api/cron/ingest/fred — Protected FRED macro ingestion endpoint

## Data and quant core
- lib/data/contracts.ts — observation and feature contracts
- lib/data/quality.ts — timestamp, confidence, freshness and status validation
- lib/data/source-registry.ts — candidate sources and activation metadata
- lib/ingestion/fred-adapter.ts — DFII10, DTWEXBGS and DGS10 series
- lib/ingestion/runner.ts — adapter execution and validation
- lib/ingestion/supabase-rest.ts — idempotent server-side persistence
- lib/quant/engine.ts — versioned, coverage-aware composite scoring
- supabase/migrations/ — relational schema, seeds and RLS policies

The score engine accepts normalized feature scores, not raw market values in incompatible units. It withholds output when minimum coverage, group count or confidence requirements are not met.

## Environment
Copy .env.example to .env.local. FRED ingestion requires FRED_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET. Never expose the service-role key to a browser. The health endpoint reports configuration presence only; it does not validate credentials or imply that feeds are live.

## Data integrity
Every production observation must preserve source, observed/published/fetched timestamps, unit, status and confidence. FRED does not provide an exact publication timestamp in the observation response used here, so published_at is left null. Raw observations are deduplicated and never silently overwritten with guessed values.

## Documentation
See docs/ARCHITECTURE.md, docs/DATA_SOURCES.md, docs/INGESTION.md, docs/QUANT_MODEL.md and docs/SUPABASE.md.

## Disclaimer
SilverScope is intended as a general market research and information tool. It is not personalized investment advice, a solicitation, or a guarantee of trading outcomes. Regulatory review is required before offering paid signals or strategy features in any target jurisdiction.
