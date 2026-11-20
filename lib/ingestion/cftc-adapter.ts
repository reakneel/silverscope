import type { Observation } from "../data/contracts";
import type { SourceAdapter } from "./runner";

const DATASET_ID = "72hh-3qpy";
const CONTRACT_CODE = "084691"; // COMEX standard Silver futures; excludes Micro Silver.
interface CftcRow {
  id?: string;
  report_date_as_yyyy_mm_dd?: string;
  cftc_contract_market_code?: string;
  market_and_exchange_names?: string;
  m_money_positions_long_all?: string | number;
  m_money_positions_short_all?: string | number;
}
function parsePosition(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw || raw === "." || !/^-?\d[\d,]*(?:\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export class CftcSilverAdapter implements SourceAdapter {
  readonly sourceId = "cftc";
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
    private readonly pageSize = 5000,
  ) {}
  async fetch(since?: string): Promise<Observation[]> {
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error("since must use YYYY-MM-DD format.");
    const rows: CftcRow[] = [];
    let offset = 0;
    const pageSize = Math.max(1, Math.min(this.pageSize, 5000));
    for (let page = 0; page < 20; page++) {
      const url = new URL(`https://publicreporting.cftc.gov/resource/${DATASET_ID}.json`);
      const filters = [`cftc_contract_market_code='${CONTRACT_CODE}'`];
      if (since) filters.push(`report_date_as_yyyy_mm_dd >= '${since}T00:00:00'`);
      url.searchParams.set("$where", filters.join(" AND "));
      url.searchParams.set("$order", since ? "report_date_as_yyyy_mm_dd ASC" : "report_date_as_yyyy_mm_dd DESC");
      url.searchParams.set("$limit", String(since ? pageSize : 1));
      url.searchParams.set("$offset", String(offset));
      const response = await this.fetchImpl(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`CFTC request failed (HTTP ${response.status}).`);
      const batch = await response.json() as CftcRow[];
      if (!Array.isArray(batch)) throw new Error("CFTC returned an unexpected response shape.");
      rows.push(...batch);
      if (!since || batch.length < pageSize) break;
      offset += batch.length;
      if (page === 19) throw new Error("CFTC backfill exceeded the 100,000-row safety limit.");
    }
    const fetchedAt = this.clock().toISOString();
    return rows.flatMap((row) => {
      if (row.cftc_contract_market_code !== CONTRACT_CODE) return [];
      const date = row.report_date_as_yyyy_mm_dd?.slice(0, 10);
      const long = parsePosition(row.m_money_positions_long_all);
      const short = parsePosition(row.m_money_positions_short_all);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || long === null || short === null) return [];
      return [{
        sourceId: this.sourceId, indicatorKey: "cftc_managed_money_net",
        value: long - short, unit: "contracts",
        observedAt: `${date}T00:00:00.000Z`, publishedAt: null, fetchedAt,
        confidence: 0.98, status: "verified" as const,
        sourceUrl: `https://publicreporting.cftc.gov/Commitments-of-Traders/Disaggregated-Futures-Only/${DATASET_ID}`,
        sourceRecordId: row.id ?? `${CONTRACT_CODE}:${date}`,
      }];
    });
  }
}
