# SilverScope

SilverScope is a silver-market intelligence and quantitative research SaaS. It organizes inventory, macro, supply-demand and positioning evidence into transparent market context, indicators and research signals.

> **Current status:** Early Next.js MVP scaffold. The UI deliberately contains no fabricated live prices, inventory readings, model scores, backtest results or performance claims. Market data, authentication, billing and automated alerts are not connected yet.

## Stack

- Next.js App Router + TypeScript
- React 19
- Custom responsive dark-terminal UI
- Planned: Supabase (Postgres/Auth), Stripe, Python quant services, Vercel Cron

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Routes

- `/` — Market overview
- `/signals` — Signal methodology and evidence placeholders
- `/indicators` — Planned indicator catalogue
- `/pricing` — Proposed subscription tiers (checkout disabled)

## Environment

Copy `.env.example` to `.env.local`. No environment variables are required for the current demo scaffold.

## Quant model principles

Initial research weights (30% inventory/liquidity, 25% macro, 30% supply/demand, 15% positioning) are hypotheses only. Before a score is published, the system must define directionality, normalization, missing-data policy, freshness limits, outlier handling, confidence and validation methodology.

Every observation should preserve:
- source and source URL/reference
- observed_at, published_at and fetched_at
- unit and methodology
- data_status: verified / estimated / manual / stale / unavailable
- confidence and quality flags

## Deployment

Import this repository into Vercel and use the default Next.js settings. Add production environment variables only when the corresponding integrations are implemented. GitHub pushes to the production branch can trigger deployments automatically.

## Disclaimer

SilverScope is intended as a general market research and information tool. It is not personalized investment advice, a solicitation, or a guarantee of trading outcomes. Regulatory review is required before offering paid signals or strategy features in any target jurisdiction.
