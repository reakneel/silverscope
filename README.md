# SilverScope

SilverScope is a silver-market intelligence and quantitative research SaaS. It organizes inventory, macro, supply-demand and positioning evidence into transparent market context, indicators and research signals.

> **Current status:** The web MVP and first data/quant foundation are implemented. No production data source, Supabase project, authentication, billing or automated alert delivery is connected. The UI must not imply otherwise.

## Stack
- Next.js App Router + TypeScript + React 19
- Deterministic TypeScript scoring and data-quality core
- Supabase Postgres/Auth schema migration (not yet applied to a live project)
- Planned: licensed market-data adapters, Python research/backtesting workers, Stripe

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
- /api/health — Application configuration status (not a market-data status guarantee)

## Data and quant core
- lib/data/contracts.ts — observation and feature contracts
- lib/data/quality.ts — timestamp, confidence, freshness and status validation
- lib/data/source-registry.ts — candidate sources and activation metadata
- lib/ingestion/runner.ts — adapter execution and validation
- lib/quant/engine.ts — versioned, coverage-aware composite scoring
- supabase/migrations/ — initial relational schema and RLS policies

The score engine accepts normalized feature scores, not raw market values in incompatible units. It withholds output when minimum coverage, group count or confidence requirements are not met.

## Environment
Copy .env.example to .env.local. Supabase and Stripe variables are optional for the demo scaffold and are not configured in production yet.

## Data integrity
Every production observation must preserve source, observed/published/fetched timestamps, unit, status and confidence. Raw observations should be immutable and deduplicated. Missing, stale or low-confidence data must never be silently replaced with plausible values.

## Documentation
See docs/ARCHITECTURE.md, docs/DATA_SOURCES.md, docs/INGESTION.md, docs/QUANT_MODEL.md and docs/SUPABASE.md.

## Disclaimer
SilverScope is intended as a general market research and information tool. It is not personalized investment advice, a solicitation, or a guarantee of trading outcomes. Regulatory review is required before offering paid signals or strategy features in any target jurisdiction.
