# Data Source Register

This is a source discovery and activation register. A listed source is not considered connected or licensed until credentials, access terms and ingestion checks have been verified.

| Domain | Candidate source | Data | Cadence | Status / notes |
|---|---|---|---|---|
| Macro | FRED DFII10 | 10-year US real yield | daily | Adapter implemented; API key required |
| Macro | FRED DTWEXBGS | Broad trade-weighted USD index | daily | Adapter implemented; not ICE DXY |
| Macro | FRED DGS10 | 10-year US nominal yield | daily | Adapter implemented; API key required |
| Positioning | CFTC Disaggregated Futures Only | COMEX standard silver managed-money net contracts | weekly | Adapter implemented; dataset 72hh-3qpy, contract 084691; excludes Micro Silver |
| Futures / inventory | CME / COMEX | Registered, eligible and total silver warehouse stocks | daily | CSV import adapter implemented for official Silver Stocks report; manual XLS-to-CSV conversion remains required; confirm CME data terms before commercial redistribution |
| Futures pricing | CME Group | COMEX silver futures settlement | daily | Website values are delayed until midnight CT; earlier access and DataMine files require relevant CME data arrangements |
| Physical vaults | LBMA | vault holdings | monthly | Requires an authorized data source / licence; no adapter activated |
| Spot benchmark | LBMA / ICE IBA | LBMA Silver Price | daily | Usage licence required for valuation, pricing, transaction or financial-product use; no feed connected |
| Spot reference | Contracted market-data vendor | Silver spot USD / troy oz | daily / intraday | CSV import adapter and licence gate implemented; provider contract, source URL and permitted use must be verified before activation |
| China market | SHFE / SGE | inventories, premiums, trading data | daily/weekly | Verify public availability and terms |
| Policy expectations | CME FedWatch | implied policy probabilities | event-driven | Confirm permitted use |
| Industry | Silver Institute / Metals Focus | annual supply-demand studies | annual | May require licensed reports |
| Solar / electronics | Industry research providers | manufacturing and silver intensity | monthly/quarterly | Vendor access may be paid |

## CFTC field semantics
The implemented adapter uses the official Disaggregated Futures Only dataset, filters the standard COMEX Silver contract code `084691`, and computes managed-money net as long minus short positions. It intentionally excludes Micro Silver (`084694`) and does not mix futures-only with futures-and-options-combined reports. CFTC report date is the Tuesday position date; the exact publication timestamp is not inferred, so `published_at` remains null. Historical paging is capped at 100,000 rows per request.

## Required source metadata
source_id, source_name, source_url, license_status, publication_frequency, expected_delay, ingestion_method, owner, last_success_at.

FRED and CFTC adapters are implemented but remain inactive until database credentials are configured and controlled ingestion is verified. The CME inventory CSV parser and protected import route are implemented, but the official XLS must be converted to CSV and imported by an authorized operator. No silver spot or settlement price feed is connected.
