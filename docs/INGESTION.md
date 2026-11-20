# Data ingestion and quality pipeline

## Current implementation
The repository provides typed observation contracts, validation rules, a source registry, a FRED macro adapter, an ingestion runner and a server-side Supabase REST persistence adapter. FRED ingestion is available through a protected cron route, but it is inactive until API credentials and a Supabase project are configured.

## FRED macro adapter
The adapter retrieves three primary-source series:
- DFII10 → 10-year US real yield
- DTWEXBGS → broad trade-weighted US dollar index (not ICE DXY)
- DGS10 → 10-year US nominal Treasury yield

The FRED API requires a registered API key. Latest mode requests the newest observation per series; backfill mode accepts a YYYY-MM-DD start date and requests up to 100,000 observations per series. FRED's observation endpoint does not provide an exact publication timestamp in this payload, so published_at remains null rather than being guessed. The observation date is stored at midnight UTC as a date-only convention.

## Protected ingestion endpoint
GET or POST /api/cron/ingest/fred requires Authorization: Bearer CRON_SECRET. It also requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FRED_API_KEY. The endpoint:
1. Fetches the configured FRED series.
2. Validates timestamp, confidence, freshness and status.
3. Creates an ingestion run.
4. Inserts observations using a deterministic dedupe key and ignore-duplicates semantics.
5. Records accepted/rejected counts and run status.

The service-role key is only read server-side. Do not expose it in client code or logs. Configure CRON_SECRET in Vercel before scheduling or manually invoking the route.

## Source activation checklist
A source remains disabled until ownership, license/redistribution terms, API limits, cadence, publication lag, units, schema, backfill behavior and failure modes have been documented. The registry is a catalogue, not proof of connectivity.

## Other source candidates
- CFTC: weekly positioning reports; align report date and publication date.
- CME/COMEX: inventory and futures data; verify redistribution terms.
- LBMA: vault and physical-market data; verify access and licensing.

No silver spot feed is enabled by default. Do not substitute a proxy series and label it spot silver.
