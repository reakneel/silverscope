# Data ingestion and quality pipeline

## Current implementation
The repository provides typed observation contracts, validation rules, a source registry and an adapter runner. The runner validates adapter output and returns accepted and rejected records; persistence is not wired until a Supabase project and server credentials are configured.

## Adapter contract
Implement SourceAdapter with a stable sourceId and fetch(since?) method. Each observation must include source and indicator identifiers, numeric value and explicit unit, observed/published (nullable)/fetched timestamps, confidence from 0 to 1, status, and source URL/record ID where available.

The runner rejects malformed, stale, future-dated, unavailable and policy-disallowed observations. Production persistence should use a stable dedupe_key and retain raw payloads without mutating historical observations.

## Source activation checklist
A source remains disabled until ownership, license and redistribution terms, API limits, cadence, publication lag, units, schema, backfill behavior and failure modes have been documented. The registry is a catalogue, not proof of connectivity.

## Initial source candidates
- FRED: macro series through its public API; requires an API key and per-series metadata.
- CFTC: weekly positioning reports; align report date and publication date.
- CME/COMEX: inventory and futures data; verify redistribution terms.
- LBMA: vault and physical-market data; verify access and licensing.

No silver spot feed is enabled by default. Do not substitute a proxy series and label it spot silver.
