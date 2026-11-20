# Ingestion Operations

## FRED macro adapter
The FRED adapter fetches DFII10 (10-year real yield), DTWEXBGS (broad trade-weighted USD index; not ICE DXY) and DGS10 (10-year nominal yield). It leaves `published_at` null when the response does not supply an exact publication timestamp. Latest-run mode fetches the latest available observation per series; `?since=YYYY-MM-DD` requests a historical range.

## CFTC silver positioning adapter
The CFTC adapter reads the official Disaggregated Futures Only Socrata dataset `72hh-3qpy`, filters COMEX standard Silver contract code `084691`, and calculates managed-money net contracts as long minus short. It excludes Micro Silver and the futures-and-options-combined universe. Report date is the Tuesday position date; publication time is not guessed. Historical pagination is capped at 100,000 rows.

## COMEX warehouse stocks CSV import
CME publishes an official Silver Stocks spreadsheet from its [NYMEX / COMEX Delivery Notices & Stocks page](https://www.cmegroup.com/solutions/clearing/operations-and-deliveries/nymex-delivery-notices.html). The adapter accepts a CSV export with `Date` / `Report Date`, optional `Depository` / `Warehouse`, `Registered` and `Eligible` columns. It aggregates warehouse rows, prefers a single explicit TOTAL row when present, rejects duplicate warehouses / multiple dates / ambiguous totals, and persists registered, eligible and derived total ounces. `published_at` remains null because the imported file does not provide a verified publication timestamp. This is an operator-driven import, not a scheduled live feed.

## Protected endpoints
- `GET /api/cron/ingest/fred`
- `GET /api/cron/ingest/cftc`
- `POST /api/cron/ingest/cme-comex` (raw `text/csv` body; requires `Authorization: Bearer $CRON_SECRET`)
- `GET /api/cron/calibration/preview`
- `GET /api/cron/score`
- Authorization header: `Bearer $CRON_SECRET`
- FRED requires `FRED_API_KEY`; CFTC public reporting endpoint does not require a key for polite usage.
- Ingestion, calibration preview and scoring require `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.

## Historical calibration preview
The preview endpoint requests up to 5,000 observations independently for each of the initial macro and CFTC positioning indicators. It derives the sample mean and sample standard deviation from verified observations only and requires at least 52 samples per indicator. It returns a suggested `SILVER_FEATURE_CALIBRATION_JSON` value but does not save or activate it. The selected sample window and market-regime coverage must be reviewed before using the result; full-history statistics are not a substitute for point-in-time walk-forward calibration.

## Quant scoring endpoint
- `GET /api/cron/score`
- Required server environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SILVER_FEATURE_CALIBRATION_JSON`
- Calibration JSON must contain empirically estimated parameters. An absent/invalid calibration returns a configuration error; insufficient coverage returns an explicit non-scored response.
- Scores and signals are persisted with a SHA-256 fingerprint of model version, calibration and normalized inputs, so scheduled retries do not create duplicate snapshots.

## Operational notes
The CME inventory import requires the new `0006_cme_inventory_indicators.sql` migration before persistence. Convert the official XLS to CSV using a trusted local spreadsheet tool, inspect the report date and column totals, then POST the CSV bytes with `Content-Type: text/csv`. Do not import files from unofficial mirrors.

Apply migrations in numerical order. Use a staging project first. Start with a narrow historical backfill and verify counts, timestamps, units, duplicate behavior and source status before scheduling production jobs. Keep secrets server-side. Do not schedule ingestion until the source access terms and retention requirements are reviewed.
