# Local Supabase backups and cold data retention

SilverScope uses Supabase as the online primary database and operator-controlled encrypted local storage for independent backups. Never store dumps or cold archives in Git, the Vercel deployment filesystem, or the same Supabase project being backed up.

## PostgreSQL full backup

The Bash and PowerShell scripts create a PostgreSQL custom-format logical dump, verify it with pg_restore --list, and write SHA-256 and JSON manifests.

Windows:

~~~powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[project-ref]:[URL-ENCODED-PASSWORD]@[host]:5432/postgres?sslmode=require"
./scripts/db/backup-supabase.ps1
~~~

macOS/Linux:

~~~bash
export SUPABASE_DB_URL='postgresql://...'
BACKUP_ROOT="$HOME/silverscope-backups" RETENTION_DAYS=30 bash scripts/db/backup-supabase.sh
~~~

Use PostgreSQL client tools compatible with the remote major version. Prefer direct connection where IPv6 is available, otherwise Supabase Session Pooler. Do not use Transaction Pooler for pg_dump. Use the database password, not the service-role API key.

## Storage object backup

The Storage sync pulls public and private bucket object bytes to backups/supabase-storage, verifies local SHA-256 before skipping, records metadata and does not mirror remote deletions:

~~~powershell
$env:SUPABASE_URL = "https://[project-ref].supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "local service-role key"
python ./scripts/db/sync-supabase-storage.py
~~~

This is a one-way local backup; automatic Storage restore is not implemented. PostgreSQL dumps do not contain Storage object bytes.

## Historical observation cold archive

The cold archive is a separate backup class. It is read-only by default and stores all observation fields in timestamped gzip CSV files plus JSON manifests.

~~~powershell
$env:SUPABASE_DB_URL = "your PostgreSQL connection URI"
python ./scripts/db/cold-archive-observations.py --cutoff-days 365
python ./scripts/db/cold-archive-observations.py --verify-archive ".\backups\cold-observations\archive.csv.gz"
~~~

Only use --apply-delete --archive-file after reviewing an existing generated archive and copying both the gzip file and its JSON manifest to a second independent location. The destructive command never generates a fresh archive implicitly. The script verifies SHA-256, gzip/CSV/JSON structure, row count, unique IDs, current row hashes and the complete eligible set inside one transaction. If a row changed, disappeared, or a new eligible row appeared after export, deletion aborts and rolls back. The local archive is never automatically pruned. Important: deleting verified rows makes PostgreSQL pages reusable after vacuum, but it does not guarantee immediate physical disk reduction. Inspect Supabase Database Size and Disk Size reports plus dead-tuple estimates first. Supabase metrics are updated daily; VACUUM FULL can rewrite a table and release space but holds an ACCESS EXCLUSIVE lock for the duration. Treat that as a separate maintenance-window operation, not part of the archive script. See [Supabase database-size guidance](https://supabase.com/docs/guides/platform/database-size) and [safe deletion guidance](https://supabase.com/docs/guides/database/postgres/data-deletion).

Restore a cold archive only to a local database:

~~~powershell
npx supabase start
$env:RESTORE_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
python ./scripts/db/cold-archive-observations.py --restore-local ".\backups\cold-observations\archive.csv.gz"
~~~

The restore verifies exact row hashes and refuses non-local hosts.

## Recovery policy

- Full database dumps: 30-day default retention; copy critical dumps to a second encrypted device/account.
- Storage objects: retain local copies; remote deletion is not mirrored.
- Cold observations: retain canonical gzip archives and manifests indefinitely unless the operator explicitly changes the retention policy.
- Perform a local restore drill before destructive migrations or data deletion.
- Keep backup classes separate: PostgreSQL dump, Storage object copy and cold observation export protect different data.
