# Data Source Register

This is a source discovery checklist, not a statement that feeds are connected or licensed.

| Domain | Candidate source | Data | Cadence | Notes |
|---|---|---|---|---|
| Futures / inventory | CME / COMEX | warehouse stocks, futures curve | daily | Check redistribution terms |
| Physical vaults | LBMA | vault holdings | monthly | Confirm access and licensing |
| China market | SHFE / SGE | inventories, premiums, trading data | daily/weekly | Verify public availability and terms |
| Positioning | CFTC | commitments of traders | weekly | Public reports; publication lag |
| Macro | FRED / US Treasury | rates, yields, dollar proxies | daily/weekly | Check API limits |
| Policy expectations | CME FedWatch | implied policy probabilities | event-driven | Confirm permitted use |
| Industry | Silver Institute / Metals Focus | annual supply-demand studies | annual | May require licensed reports |
| Solar / electronics | Industry research providers | manufacturing and silver intensity | monthly/quarterly | Vendor access may be paid |

## Required source metadata
source_id, source_name, source_url, license_status, publication_frequency, expected_delay, ingestion_method, owner, last_success_at.

No source should be treated as production-ready until terms, update cadence, schema and quality checks are documented.
