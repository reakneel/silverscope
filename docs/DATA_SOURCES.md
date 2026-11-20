# Data Source Register

This is a source discovery and activation register. A listed source is not considered connected or licensed until credentials, access terms and ingestion checks have been verified.

| Domain | Candidate source | Data | Cadence | Notes |
|---|---|---|---|---|
| Macro | FRED DFII10 | 10-year US real yield | daily | API key required; exact publication timestamp is not included in the observation response |
| Macro | FRED DTWEXBGS | Broad trade-weighted USD index | daily | This is not the ICE DXY index |
| Macro | FRED DGS10 | 10-year US nominal Treasury yield | daily | API key required |
| Futures / inventory | CME / COMEX | warehouse stocks, futures curve | daily | Check redistribution terms |
| Physical vaults | LBMA | vault holdings | monthly | Confirm access and licensing |
| China market | SHFE / SGE | inventories, premiums, trading data | daily/weekly | Verify public availability and terms |
| Positioning | CFTC | commitments of traders | weekly | Public reports; publication lag |
| Policy expectations | CME FedWatch | implied policy probabilities | event-driven | Confirm permitted use |
| Industry | Silver Institute / Metals Focus | annual supply-demand studies | annual | May require licensed reports |
| Solar / electronics | Industry research providers | manufacturing and silver intensity | monthly/quarterly | Vendor access may be paid |

## Required source metadata
source_id, source_name, source_url, license_status, publication_frequency, expected_delay, ingestion_method, owner, last_success_at.

FRED is the first implemented adapter, but it remains inactive until the API key and Supabase credentials are configured. The FRED observation API requires a registered API key and supports observation-date range, sort order and limit parameters. The ingestion adapter leaves published_at null when the endpoint does not provide a publication timestamp.

No source should be treated as production-ready until terms, update cadence, schema and quality checks are documented. No silver spot source is connected.
