# SilverScope data operations and historical warehouse

## Architecture

- observations: online hot store for recent source observations.
- observation_history: server-only view that unions the hot table and optional in-database monthly partitions.
- Local cold archive: independently stored compressed CSV/JSON records containing the complete observation row, a PostgreSQL-computed row hash, SHA-256 manifest, row count and observation time bounds.
- DuckDB can query the compressed local archive without loading the entire history into PostgreSQL.

The local cold archive is the capacity-management boundary. The monthly PostgreSQL partition archive is not enabled by scheduled jobs and does not reduce database bytes. Vercel cannot prove that a backup on an operator's workstation exists, so the server-side archive endpoint is deliberately disabled (HTTP 410).

## Cold archive and safe migration

Use scripts/db/cold-archive-observations.py. It requires PostgreSQL psql and a local SUPABASE_DB_URL.

Default export is read-only. It exports rows older than 365 days to a timestamped .csv.gz file. Each record contains the original observation row and a PostgreSQL MD5 row fingerprint; the adjacent JSON manifest contains SHA-256, row count, cutoff and time bounds.

~~~powershell
$env:SUPABASE_DB_URL = "your PostgreSQL connection URI"
python ./scripts/db/cold-archive-observations.py --cutoff-days 365
~~~

Verify a previously created archive offline:

~~~powershell
python ./scripts/db/cold-archive-observations.py --verify-archive ".\backups\cold-observations\silverscope-observations-before-YYYYMMDDTHHMMSSZ.csv.gz"
~~~

Only after reviewing the archive and copying both the gzip file and its JSON manifest to a second independent location, explicitly allow source-row deletion using that already-created archive (the delete command does not create a new backup):

~~~powershell
python ./scripts/db/cold-archive-observations.py --apply-delete --archive-file ".\\backups\\cold-observations\\silverscope-observations-before-YYYYMMDDTHHMMSSZ.csv.gz"
~~~

The deletion transaction imports the exact archived ID/hash set into a temporary table and verifies:
1. SHA-256 and gzip/CSV/JSON integrity before any database mutation.
2. No duplicate observation IDs and exact exported row count.
3. Every current source row still has the same ID and PostgreSQL-computed row hash.
4. The complete currently eligible set still equals the exported set; new old-dated rows cause an abort.
5. The number of deleted rows exactly equals the archive row count.

Any mismatch raises an error and rolls back the transaction. No source rows are deleted in the default mode. The script never prunes local archive files.

### Local restore drill

Start a local Supabase stack with the matching migrations/schema, then restore into its local PostgreSQL database:

~~~powershell
npx supabase start
$env:RESTORE_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
python ./scripts/db/cold-archive-observations.py --restore-local ".\backups\cold-observations\silverscope-observations-before-YYYYMMDDTHHMMSSZ.csv.gz"
~~~

Restore refuses non-local hosts, inserts without overwriting conflicting dedupe keys, and verifies exact row hashes before commit. A conflict mismatch aborts and rolls back.

### Query cold data with DuckDB

Install DuckDB locally, then query the gzip CSV archive. The JSON record has the full source row under row:

~~~sql
SELECT
  json_extract_string(archive_record, '$.row.indicator_key') AS indicator_key,
  CAST(json_extract_string(archive_record, '$.row.observed_at') AS TIMESTAMPTZ) AS observed_at,
  CAST(json_extract_string(archive_record, '$.row.value') AS DOUBLE) AS value
FROM read_csv('backups/cold-observations/*.csv.gz');
~~~

For repeated analysis, materialize a compressed Parquet file from DuckDB after validating the input archive:

~~~sql
COPY (
  SELECT
    json_extract_string(archive_record, '$.row.indicator_key') AS indicator_key,
    CAST(json_extract_string(archive_record, '$.row.observed_at') AS TIMESTAMPTZ) AS observed_at,
    CAST(json_extract_string(archive_record, '$.row.value') AS DOUBLE) AS value,
    archive_record
  FROM read_csv('backups/cold-observations/*.csv.gz')
) TO 'silver-observations-cold.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
~~~

Keep the original SHA-256 verified gzip archives as the canonical backup; Parquet is a derived analytics copy.

## Automated collection and monitoring

The Vercel cron schedule is declared in vercel.json; Git-triggered deployments remain disabled.

| Job | Schedule (UTC) | Behaviour |
|---|---|---|
| Daily dispatcher | 22:00 daily | Weekday FRED ingestion, daily source-health and data-quality checks |
| Weekly dispatcher | Friday 22:15 | CFTC COMEX standard Silver (084691) positioning ingestion |

Cron jobs require Production CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FRED credentials. Only FRED/CFTC public datasets are automated. CME inventory and licensed spot prices remain controlled imports until stable delivery and redistribution rights are established.

Source-health and quality monitors persist recent status, exact publication timestamp coverage, unverified observation counts and ingestion acceptance/rejection rates. Missing published_at remains missing; it is never inferred from observed_at.

## Important distinction

A local cold archive reduces Supabase database usage only after the operator explicitly runs the verified --apply-delete flow. Local copies do not automatically reduce Supabase Storage usage, and PostgreSQL dumps do not contain Storage object bytes. Keep database dumps, Storage object copies and cold observation archives as separate backup classes.
