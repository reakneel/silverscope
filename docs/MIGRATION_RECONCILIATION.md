# Supabase migration history reconciliation

**Do not run `supabase db push` until this check is completed.**

The repository currently contains two migration files with the same numeric version prefix `0006`:
- `0006_cme_inventory_indicators.sql`
- `0006_research_snapshots.sql`

Supabase CLI migration versions must be unique. The project also has an existing `0007_stripe_webhook_events.sql`. The new warehouse and monitoring migrations use `0008` and `0009`, but adding them does not resolve the older duplicate.

No database migration history was queried or changed during this code phase. The Vercel Supabase connector connection alone does not establish which migrations have been applied.

## Safe procedure

1. In a staging Supabase project, inspect `supabase_migrations.schema_migrations` and run `supabase migration list` with the linked project.
2. If none of the duplicate-prefix migrations has been applied, assign unique ordered versions to the two 0006 files and the 0007 file, update references/docs, and validate the resulting migration list before pushing.
3. If any migration has already been applied, do not rename it blindly. Preserve the applied remote version and use `supabase migration repair` only after comparing exact SQL contents and intended order.
4. Take a verified database backup before applying any production migration.
5. Apply to staging first, test RLS, auth, ingestion, archive and restore parity, then apply to production in a maintenance window.

This repository intentionally does not guess the remote migration state or auto-apply SQL through a connector.
