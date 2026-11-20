# Local Supabase backups

SilverScope uses Supabase as the online primary database and a user-controlled workstation/server as the independent backup destination. Never store dumps or object backups in Git, the Vercel deployment filesystem, or the same Supabase project being backed up.

## PostgreSQL database backup

The Bash and PowerShell scripts create a PostgreSQL custom-format logical dump, verify it with `pg_restore --list`, and write SHA-256 and JSON manifests. They include schemas and table data readable by the database role, but do not include Storage object bytes, Vercel environment variables, provider secrets or external files.

Use PostgreSQL client tools compatible with the remote PostgreSQL major version. Prefer the Supabase direct database URI where IPv6 is available; otherwise use the **Session Pooler** URI. Do not use the transaction pooler for `pg_dump`. Use the PostgreSQL database password, not the Supabase service-role API key.

Windows PowerShell from the repository root:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[project-ref]:[URL-ENCODED-PASSWORD]@[host]:5432/postgres?sslmode=require"
./scripts/db/backup-supabase.ps1
```

Optional retention and destination:

```powershell
./scripts/db/backup-supabase.ps1 -RetentionDays 90 -BackupRoot "E:\SilverScopeBackups"
```

macOS/Linux:

```bash
export SUPABASE_DB_URL='postgresql://...'
BACKUP_ROOT="$HOME/silverscope-backups" RETENTION_DAYS=30 bash scripts/db/backup-supabase.sh
```

## Supabase Storage object backup

The Storage sync pulls all buckets (public and private) and object bytes to a separate local directory. It is incremental: objects are skipped only when remote metadata signature and the locally verified SHA-256 both match the previous manifest. Remote deletions are deliberately **not** mirrored, so a remote accidental deletion does not erase the local backup.

Requirements: Python 3.10+ (standard library only), network access, and a Supabase service-role key. Set these variables only in your local shell/secret manager:

```powershell
$env:SUPABASE_URL = "https://[project-ref].supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-local-service-role-key"
python ./scripts/db/sync-supabase-storage.py
```

Optional output and bucket selection:

```powershell
python ./scripts/db/sync-supabase-storage.py --output "E:\SilverScopeStorageBackup"
python ./scripts/db/sync-supabase-storage.py --bucket "research-artifacts"
```

Preview without downloading:

```powershell
python ./scripts/db/sync-supabase-storage.py --dry-run
```

Default output is `backups/supabase-storage`, which is ignored by Git. The manifest records bucket configuration, object metadata, byte size and SHA-256. The script verifies existing local bytes before skipping a download. It never logs the service-role key. Store backups on encrypted disks (BitLocker/FileVault/LUKS) and copy important data to a second independent encrypted location.

This is a one-way backup/download process. It does not delete local files when remote objects disappear and does not yet implement automatic Storage restore. Keep a separate verified copy before changing bucket policies or deleting remote objects.

## Local database restore drill

Start the local Supabase stack with `npx supabase start`, confirm its local database URI, then set:

```powershell
$env:RESTORE_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$env:ALLOW_DESTRUCTIVE_RESTORE = "YES"
./scripts/db/restore-local.ps1 -BackupFile "./backups/supabase/silverscope-supabase-YYYYMMDDTHHMMSSZ.dump"
```

Restore scripts reject non-local database hosts and require explicit destructive acknowledgement. They use `--clean --if-exists` and replace objects in the target database. Never point them at production.

## Retention and capacity

- PostgreSQL backup: 30 days by default.
- Storage object backup: retain all downloaded objects; remote deletion is not mirrored.
- Keep another encrypted copy on a separate device or account.
- Perform a monthly restore drill and record the result.
- Database size and Storage object bytes are separate Supabase usage categories. Local backups do not reduce either cloud usage category.
- See `supabase/diagnostics/storage-usage.sql` for read-only PostgreSQL size diagnostics.
- The partitioned historical warehouse improves lifecycle management but remains in the same database. It does not reduce total database bytes until a separate external archive and tested retrieval path are implemented.
