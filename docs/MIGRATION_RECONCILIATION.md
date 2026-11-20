# Supabase migration history reconciliation

**Do not run supabase db push until this check is completed.**

The repository has duplicate numeric migration prefixes:
- 0006_cme_inventory_indicators.sql
- 0006_research_snapshots.sql

The repository also contains 0007_stripe_webhook_events.sql, followed by 0008_historical_warehouse.sql and 0009_data_quality_monitoring.sql.

The correct order of the two 0006 migrations cannot be inferred from filenames or from the fact that the Vercel project has a Supabase connector. No remote supabase_migrations.schema_migrations table has been queried in this development session.

## Safe reconciliation procedure

1. Create a verified full PostgreSQL backup and a separate Storage object backup.
2. Inspect remote migration history with supabase migration list and query supabase_migrations.schema_migrations using a locally configured Supabase CLI profile.
3. Compare exact SQL contents of the remote-applied versions with repository migrations.
4. If neither 0006 file has been applied, rename/resequence the local files into unique versions in a dedicated migration PR, then validate the local/remote list.
5. If either 0006 migration is already applied, do not rename or rewrite that applied version. Use supabase migration repair only after exact content and dependency reconciliation.
6. Apply to staging, verify RLS/auth/ingestion/Stripe/observation history and run restore tests. Then apply to production in a controlled window.

The application intentionally does not auto-apply SQL or guess remote migration state. The data archive migration was hardened so duplicate dedupe keys cannot cause a hot row to be deleted without exact archived-row parity, but production migration activation still requires this reconciliation.
