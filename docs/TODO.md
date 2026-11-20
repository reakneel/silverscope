# Engineering Roadmap

## P0 — MVP foundation
- [x] Create Next.js App Router scaffold
- [x] Add responsive dark-terminal layout and four core routes
- [x] Clearly label demo / disconnected data
- [x] Add product, architecture, quant and source documentation
- [x] Add deterministic quant engine and data quality tests
- [x] Add source registry and ingestion adapter contract
- [x] Add Supabase initial schema and RLS migration
- [x] Add application health endpoint
- [x] Add FRED macro adapter and protected ingestion endpoint
- [x] Add idempotent Supabase REST persistence path
- [x] Add CFTC COMEX Silver positioning adapter and protected ingestion endpoint
- [x] Add calibration-gated feature, score and signal snapshot pipeline
- [x] Add stable input-fingerprint idempotency for score/signal snapshots
- [x] Add server-side dashboard, indicator and signal data reads
- [ ] Apply migrations to a provisioned Supabase project
- [ ] Verify production credentials and run controlled ingestion

## P1 — Data and quant foundation
- [x] Design schema for sources, observations, indicators, scores and signals
- [x] Build source registry and ingestion run contract
- [x] Implement validation, freshness and provenance checks
- [x] Implement normalization helper and coverage-aware composite score
- [x] Add unit tests for score, validation and ingestion adapters
- [x] Add FRED source adapter for DFII10, DTWEXBGS and DGS10
- [x] Add CFTC disaggregated futures-only COMEX Silver managed-money net adapter
- [x] Add protected ingestion routes and deduplicated observation persistence
- [x] Add calibration preview from verified historical observations
- [x] Add calibration-driven feature generation and signal evidence snapshots
- [x] Add server-rendered latest observation and signal display
- [ ] Provision Supabase project and environments
- [ ] Configure FRED API key and cron secret
- [ ] Run controlled CFTC Silver API ingestion and historical backfill
- [ ] Review calibration window and activate validated parameters
- [ ] Implement one verified silver spot source with commercial-use rights
- [x] Implement strict COMEX registered / eligible / total inventory CSV parser and protected import route
- [ ] Automate official CME XLS ingestion after verifying a stable supported format and permitted access terms
- [ ] Add LBMA holdings and vault data adapter after obtaining licensed data access
- [ ] Add integration tests against a staging database
- [ ] Build point-in-time walk-forward research and cost-aware backtest metrics
- [ ] Add source freshness / ingestion failure monitoring and alerting

## P2 — Accounts and paid product
- [ ] Supabase Auth and protected dashboard
- [ ] Server-side entitlement checks
- [ ] Stripe products, checkout and customer portal
- [ ] Signature-verified Stripe webhooks
- [ ] Free / Pro / Ultra feature matrix
- [ ] Email / in-app alerts
- [ ] Admin source-health dashboard
- [ ] Privacy, terms, refund and risk disclosures
- [ ] Jurisdiction-specific regulatory review

## P3 — Research quality
- [ ] Historical data store and reproducible snapshots
- [ ] Walk-forward backtesting framework
- [ ] Transaction costs and slippage
- [ ] Benchmark and risk metrics
- [ ] Scenario analysis and sensitivity
- [ ] Model monitoring and drift alerts
- [ ] Research report generation
- [ ] Public API with keys, quotas and audit logs

## Definition of done
A feature is complete only when it has tests, documented data provenance where relevant, server-side permission checks where relevant, error/empty states, and verified deployment. Demo values must never be represented as live observations.
