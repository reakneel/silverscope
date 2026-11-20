# Ingestion Operations

## FRED macro adapter
The FRED adapter fetches DFII10 (10-year real yield), DTWEXBGS (broad trade-weighted USD index; not ICE DXY) and DGS10 (10-year nominal yield). It leaves `published_at` null when the response does not supply an exact publication timestamp. Latest-run mode fetches the latest available observation per series; `?since=YYYY-MM-DD` requests a historical range.

## CFTC silver positioning adapter
The CFTC adapter reads the official Disaggregated Futures Only Socrata dataset `72hh-3qpy`, filters COMEX standard Silver contract code `084691`, and calculates managed-money net contracts as long minus short. It excludes Micro Silver and the futures-and-options-combined universe. Report date is the Tuesday position date; publication time is not guessed. Historical pagination is capped at 100,000 rows.

## Protected endpoints
- `GET /api/cron/ingest/fred`
- `GET /api/cron/ingest/cftc`
- `POST /api/cron/ingest/fred`
- Authorization header: `Bearer $CRON_SECRET`
- FRED requires `FRED_API_KEY`; CFTC public reporting endpoint does not require a key for polite usage.
- Both require `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.

## Quant scoring endpoint
- `GET /api/cron/score`
- Authorization header: `Bearer $CRON_SECRET`
- Required server environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SILVER_FEATURE_CALIBRATION_JSON`
- Calibration JSON must contain empirically estimated parameters. An absent/invalid calibration returns a configuration error; insufficient coverage returns an explicit non-scored response.
- Scores and signals are persisted with unique idempotency keys so retries do not create duplicate snapshots.

## Operational notes
Apply migrations in numerical order. Use a staging project first. Start with a narrow historical backfill and verify counts, timestamps, units, duplicate behavior and source status before scheduling production jobs. Keep secrets server-side. Do not schedule ingestion until the source access terms and retention requirements are reviewed.
