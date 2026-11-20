# SilverScope final release checklist

This checklist separates code-complete work from account- and database-dependent activation. Do not mark external steps complete from a successful GitHub build alone.

## Code and CI
- [x] Next.js application, market data contracts, provenance and point-in-time checks
- [x] FRED and CFTC ingestion adapters and protected routes
- [x] Quant research, walk-forward, cost, margin and portfolio simulation primitives
- [x] Account, entitlement, Stripe and owner-scoped API implementation
- [x] Persisted source-health and data-quality monitoring
- [x] Local PostgreSQL full backup and guarded local restore
- [x] Local Supabase Storage object backup with SHA-256 manifest
- [x] Local observation cold archive with opt-in, row-hash/count-verified deletion
- [x] Cold archive local restore restricted to localhost
- [x] CI tests for quant, Storage backup and cold archive safety
- [ ] Merge finalization PR and confirm main CI

## Supabase activation
- [ ] Reconcile duplicate migration version prefix 0006 against actual remote history
- [ ] Apply migrations to staging and run auth/RLS/ingestion/Stripe/history integration tests
- [ ] Take and verify full database + Storage + cold archive backups before production migration
- [ ] Apply migrations to production
- [ ] Configure production Supabase URL and service-role key in Vercel
- [ ] Run a controlled FRED/CFTC ingestion and verify persisted rows and monitor snapshots
- [ ] Perform a local database restore and cold archive restore drill

## Vercel and billing activation
- [ ] Configure CRON_SECRET and FRED_API_KEY in Production
- [ ] Configure Stripe products, Price IDs, webhook endpoint and customer portal
- [ ] Manual production deployment after migration and credentials are ready
- [ ] Verify homepage, health, sign-in, billing, ingestion and monitoring endpoints
- [ ] Verify scheduled jobs execute successfully after deployment

## Product/legal release
- [ ] Configure one licensed silver spot source before representing spot prices as live
- [ ] Complete privacy, terms, refund and investment-risk disclosures
- [ ] Complete jurisdiction-specific legal review
- [ ] Confirm account-specific pages and APIs enforce ownership and entitlement

## Release gate

The project is code-complete when the final PR is merged and CI is green. It is production-ready only after the external Supabase, Vercel, data-source and Stripe steps above have been executed and verified. No live market data, backtest performance or production activation should be claimed before evidence exists.
