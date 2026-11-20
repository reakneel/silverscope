# Local Supabase database backups

SilverScope treats Supabase as the online primary database and a user-controlled workstation/server as an independent backup destination. Do not store database dumps in the Git repository, Vercel deployment filesystem, or the same Supabase project being backed up.

## What is backed up

The scripts create a PostgreSQL custom-format logical dump with schema and table data readable by the database role, plus a SHA-256 checksum and JSON manifest. The archive is compressed by pg_dump and can be inspected with pg_restore. It is not a byte-for-byte physical snapshot.

The database dump does **not** contain Supabase Storage object bytes, Vercel environment variables, Stripe/FRED credentials, or external files. Storage bucket metadata may be in database tables, but the actual objects need a separate Storage export/download process. Never put service-role keys or database passwords in Git.

## Requirements

- PostgreSQL client tools compatible with the remote PostgreSQL major version: `pg_dump` and `pg_restore`.
- A Supabase database connection URI from Supabase Dashboard → Project Settings → Database → Connection string. Prefer the direct connection where IPv6 is available; otherwise use the Supabase **Session pooler** URI. Do not use the transaction pooler for pg_dump.
- Use the database connection password/role, not `SUPABASE_SERVICE_ROLE_KEY` (that key is an HTTP API credential, not a PostgreSQL password).
- Keep the workstation disk encrypted (BitLocker/FileVault/LUKS), restrict access to the backup folder, and copy important archives to a second physically or administratively separate encrypted disk. Dumps contain private user and subscription data.

## Windows PowerShell (recommended for this workstation)

Open PowerShell in the repository root. Set the database URI for the current shell only; avoid pasting it into scripts or committing it:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[project-ref]:[URL-ENCODED-PASSWORD]@[host]:5432/postgres?sslmode=require"
.scriptsdbackup-supabase.ps1
```

By default archives are written to `backups/supabase` and backups older than 30 days are pruned. Override the retention period or destination:

```powershell
.scriptsdbackup-supabase.ps1 -RetentionDays 90 -BackupRoot "E:\SilverScopeBackups"
```

Schedule the PowerShell command daily (for example 02:00 local time) with Windows Task Scheduler. The task should run under the Windows account that owns the encrypted backup directory. Use a secure secret store or task-scoped environment injection for the database URI; do not put it in a checked-in `.ps1` file or Task Scheduler command-line arguments.

## macOS / Linux

```bash
export SUPABASE_DB_URL='postgresql://...'
BACKUP_ROOT="$HOME/silverscope-backups" RETENTION_DAYS=30 bash scripts/db/backup-supabase.sh
```

The script uses a restrictive umask and directory permissions. Schedule it with cron/systemd on a machine that is powered on and has network access.

## Local restore drill

A backup is not proven until it has been restored. Start a local Supabase stack from the repository:

```bash
npx supabase start
```

The default local database URI is typically `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Confirm the actual URI printed by your Supabase CLI version. The restore scripts intentionally refuse non-local hosts and require a second explicit destructive-operation acknowledgement.

PowerShell:

```powershell
$env:RESTORE_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$env:ALLOW_DESTRUCTIVE_RESTORE = "YES"
.scripts\db\restore-local.ps1 -BackupFile ".\backups\supabase\silverscope-supabase-YYYYMMDDTHHMMSSZ.dump"
```

macOS / Linux:

```bash
RESTORE_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
ALLOW_DESTRUCTIVE_RESTORE=YES \
bash scripts/db/restore-local.sh backups/supabase/silverscope-supabase-YYYYMMDDTHHMMSSZ.dump
```

The restore operation uses `--clean --if-exists` and **replaces objects in the target database**. Never set `RESTORE_DATABASE_URL` to the production Supabase host. Verify local auth, RLS, migrations, and representative application queries after a restore. Match the local PostgreSQL major version to the source where possible.

## Storage usage report

Run `supabase/diagnostics/storage-usage.sql` in the Supabase SQL Editor to inspect database size and the largest tables/indexes. It is read-only and reports PostgreSQL database storage; Supabase Storage object bytes are billed separately.

## Retention and storage-cost policy

- Keep at least 30 daily local database archives as the initial default.
- Keep a second copy on a separate encrypted disk or storage account; a backup on the same workstation is not disaster recovery.
- Run a monthly restore drill and record its completion time and result.
- Monitor Supabase database size independently. Local dumps reduce dependence on cloud backup retention, but do not reduce the live Supabase database size or the storage used by Supabase Storage buckets.
- Do not delete historical observations simply to fit a quota. First measure table/index growth, then introduce time partitioning and an explicit archival policy with point-in-time and audit requirements. Research snapshots and experiment manifests are append-only records.
- Supabase Storage object bytes need their own bucket inventory/export process and checksum manifest; a PostgreSQL dump alone is not a complete file-storage backup.

## Current status

These scripts and runbooks are code-only until a real `SUPABASE_DB_URL` is supplied locally and a backup/restore drill is completed. The Vercel connector connection does not expose the database password to this repository or to local PowerShell. No production database has been queried, migrated, or backed up by adding these files.
