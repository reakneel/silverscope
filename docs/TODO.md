# Engineering Roadmap

## P0 — MVP foundation
- [x] Create Next.js App Router scaffold
- [x] Add responsive dark-terminal layout
- [x] Add Overview, Signals, Indicators and Pricing routes
- [x] Clearly label demo / disconnected data
- [x] Add product, architecture, quant and source documentation
- [ ] Run install, typecheck and production build
- [ ] Connect Vercel project and verify deployment

## P1 — Data and quant foundation
- [ ] Provision Supabase project and environments
- [ ] Design schema and migrations for sources, raw observations, indicators, scores and signals
- [ ] Build source registry and ingestion run logs
- [ ] Implement one verified silver price source
- [ ] Implement COMEX inventory ingestion
- [ ] Add macro source adapters
- [ ] Add validation, freshness and provenance checks
- [ ] Implement indicator normalization and coverage score
- [ ] Implement versioned composite score
- [ ] Persist score history and explanations
- [ ] Add unit and integration tests

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
