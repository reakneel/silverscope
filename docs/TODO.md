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
- [x] Add a license-gated CSV adapter and import route for silver spot reference data
- [ ] Contract and activate one verified silver spot source with commercial-use rights
- [x] Implement strict COMEX registered / eligible / total inventory CSV parser and protected import route
- [ ] Automate official CME XLS ingestion after verifying a stable supported format and permitted access terms
- [ ] Add LBMA holdings and vault data adapter after obtaining licensed data access
- [ ] Add integration tests against a staging database
- [x] Add foundational walk-forward splitter and cost-aware backtest metric primitives
- [x] Add a single-contract next-bar futures execution simulator with multiplier P&L, commissions, slippage, position caps and forced final liquidation
- [x] Add strict point-in-time feature construction that rejects unknown / future publication timestamps
- [x] Add explicit old-contract exit / new-contract entry prices to prevent roll-spread gaps from being booked as P&L
- [x] Add simplified initial / maintenance margin checks and maintenance liquidation to the single-contract simulator
- [x] Add risk-budget and margin-aware integer position sizing
- [ ] Add exchange expiry calendars, SPAN / broker margin schedules and intraday margin calls
- [x] Add bar-volume participation constrained order-fill primitive with explicit residual quantity
- [x] Add multi-contract portfolio exposure and additive-margin risk snapshot with configurable limits
- [x] Integrate volume-limited partial fills into persistent multi-contract target orders and synchronized contract rolls
- [x] Build a shared-equity multi-contract portfolio runner with persistent target orders, separate contract roll fills, fees, slippage and margin controls
- [x] Add explicit-cadence source freshness and ingestion health classification with structured alerts
- [ ] Wire scheduled health polling, persisted alert state and email / in-app delivery

## P2 — Accounts and paid product
- [x] Add Supabase password login/logout and secure HttpOnly session refresh endpoints
- [ ] Enforce authentication on all protected dashboard pages and user-owned API resources
- [x] Add server-side Free / Pro / Ultra entitlement resolver
- [x] Add authenticated Stripe subscription checkout endpoint with configured Price IDs
- [ ] Configure Stripe products/prices and customer portal in the provider account
- [x] Add timestamp-bound, signature-verified, idempotent Stripe subscription webhooks
- [x] Add Free / Pro / Ultra feature entitlement matrix
- [ ] Apply migrations 0006 and 0007 after provisioning Supabase
- [ ] Email / in-app alerts
- [ ] Admin source-health dashboard
- [ ] Privacy, terms, refund and risk disclosures
- [ ] Jurisdiction-specific regulatory review

## P3 — Research quality
- [x] Add canonical SHA-256 point-in-time research snapshots and versioned experiment manifests
- [x] Add append-only Supabase schema and owner-scoped RLS for experiment manifests, run snapshots and artifacts
- [ ] Apply migration 0006 after provisioning Supabase
- [ ] Build a persistent historical data store and reproducible dataset snapshots
- [x] Add non-overlapping out-of-sample walk-forward report aggregation with explicit calendar-gap handling
- [x] Add Bonferroni family-wise multiple-testing correction helper
- [ ] Full strategy simulation and walk-forward performance reports
- [x] Add configurable commissions and slippage to futures execution and cost-aware backtest metrics
- [x] Add benchmark, volatility, drawdown, Sharpe and Sortino metrics
- [x] Add multi-contract price-shock stress analysis with margin shortfall reporting
- [x] Add transaction-cost sensitivity analysis over explicit turnover and cost assumptions
- [ ] Add empirically calibrated liquidity / market-impact sensitivity ranges
- [ ] Model monitoring and drift alerts
- [ ] Research report generation
- [ ] Public API with keys, quotas and audit logs

## Definition of done
A feature is complete only when it has tests, documented data provenance where relevant, server-side permission checks where relevant, error/empty states, and verified deployment. Demo values must never be represented as live observations.
