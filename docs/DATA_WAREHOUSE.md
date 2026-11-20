# SilverScope historical warehouse and ingestion operations

## Data layers

- `observations` is the hot, idempotent ingestion table.
- `observation_archive` is a monthly range-partitioned historical warehouse for rows older than 365 days.
- `observation_history` is the server-only union view over hot and archived rows. Quant history readers use this view so archival does not silently remove history from research.
- Research snapshots and experiment manifests remain append-only and retain their original source timestamps and hashes.

The archive remains in the same Supabase PostgreSQL database. Partitioning improves lifecycle management and time-bounded query pruning; **it does not reduce total Supabase database bytes by itself**. To reduce the primary database footprint later, export verified partitions to an independently managed object store and only then introduce an audited external-history query path. Do not delete source rows until that path has restore and parity tests.

## Archive policy

The scheduled endpoint moves rows with `observed_at` older than 365 days in bounded batches of 5,000 rows (up to 20 batches per run) into monthly partitions. The operation is transactional per batch and retains `observed_at`, `published_at`, `fetched_at`, source identifiers, confidence, status, quality flags and raw payload. It does not infer missing publication timestamps.

Apply the warehouse migration only after reconciling the existing migration history (see [MIGRATION_RECONCILIATION.md](./MIGRATION_RECONCILIATION.md)). After applying it, the protected route is:

- `POST /api/cron/warehouse/archive` — protected by `Authorization: Bearer CRON_SECRET`.
- `npm run db:warehouse:archive` — manually invokes the configured app URL using `SILVERSCOPE_APP_URL` and `CRON_SECRET`.

## Automated ingestion

The Vercel cron schedule is declared in `vercel.json`. It keeps Git-based automatic deployments disabled.

| Job | Schedule (UTC) | Behaviour |
|---|---|---|
| Daily dispatcher | 22:00 every day | On weekdays pulls FRED; every day records source health and data-quality snapshots |
| Weekly dispatcher | Friday 22:15 | Pulls CFTC COMEX standard Silver (084691) and archives eligible older observations |

Vercel Cron sends the configured `CRON_SECRET` as a Bearer token. The two dispatcher jobs consolidate related work and keep the production schedule simple. Set the secret in the Production environment and redeploy for schedules to become active. The routes fail closed with 503 when secrets or the database are missing. Manual protected requests can use the same Bearer header.

Only FRED and CFTC are automated by this schedule. CME inventory and licensed spot prices remain controlled imports until stable, permitted source delivery and redistribution rights are established. No scraping or licensing bypass is introduced.

## Data-quality semantics

The quality monitor stores:
- Observation count in the trailing 30 days.
- Missing `published_at` count and the fraction with an exact publication timestamp.
- Non-verified observation count.
- Ingestion fetched/accepted/rejected totals and rejection ratio.

A missing `published_at` is a point-in-time eligibility limitation, not a timestamp to synthesize from `observed_at`. The monitor reports this separately and never backfills a guessed publication time. Rejected ratio above 5% is marked degraded; zero recent observations is marked insufficient data. These are operational guardrails, not a substitute for source-specific scientific validation.

Source-health thresholds are explicit operational monitoring windows in `lib/monitoring/source-cadence.ts`; they are not represented as official provider SLAs. License-blocked or disabled sources remain visible rather than being silently treated as healthy.

## First-run checklist

1. Reconcile and apply migrations in a staging Supabase project.
2. Set Vercel Production `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `FRED_API_KEY`.
3. Confirm CFTC source registry license status is `public_api` (the migration updates this known public dataset).
4. Trigger FRED and CFTC routes manually once, inspect ingestion_runs and observations.
5. Trigger source and quality monitor routes; verify rows in `source_health_checks`, `source_health_alerts` and `data_quality_checks`.
6. Verify the `observation_history` view returns the same rows before and after a small staging archive test.
7. Configure a local Supabase Storage backup separately; PostgreSQL database dumps do not include Storage object bytes.
