import type { Observation } from "../data/contracts";
import type { SourceAdapter } from "./runner";

export interface LicensedPriceCsvOptions {
  providerName: string;
  sourceUrl: string;
  fetchedAt?: string;
}
function parseRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell.trim()); cell = ""; }
    else if (char === "\n") { row.push(cell.trim()); if (row.some((item) => item)) rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell.trim());
  if (row.some((item) => item)) rows.push(row);
  return rows;
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function parseTimestamp(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error("Every price row must include a date or timestamp.");
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) throw new Error(`Invalid price timestamp: ${raw.slice(0, 40)}`);
  return new Date(time).toISOString();
}
function parsePrice(value: string): number {
  const raw = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error("Price values must be positive numeric USD per troy ounce.");
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price values must be positive numeric USD per troy ounce.");
  return price;
}
export function parseLicensedSilverPriceCsv(csv: string, options: LicensedPriceCsvOptions): Observation[] {
  if (!options.providerName.trim()) throw new Error("A licensed data provider name is required.");
  let sourceUrl: URL;
  try { sourceUrl = new URL(options.sourceUrl); } catch { throw new Error("A valid licensed provider source URL is required."); }
  if (sourceUrl.protocol !== "https:") throw new Error("Licensed provider source URL must use HTTPS.");
  if (!csv.trim() || csv.length > 2_000_000) throw new Error("CSV is empty or exceeds the 2 MB import limit.");
  const rows = parseRows(csv);
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one price row.");
  const headers = rows[0].map(normalize);
  const dateIndex = headers.findIndex((value) => ["date", "timestamp", "observationdate", "datetime"].includes(value));
  const priceIndex = headers.findIndex((value) => ["price", "close", "priceusdoz", "usddperoz", "usddperounce", "usdperoz"].includes(value));
  const recordIndex = headers.findIndex((value) => ["recordid", "providerrecordid", "id"].includes(value));
  if (dateIndex < 0 || priceIndex < 0) throw new Error("CSV headers must include Date / Timestamp and Price / USD per oz.");
  const parsed = rows.slice(1).map((row) => ({
    timestamp: parseTimestamp(row[dateIndex] ?? ""),
    price: parsePrice(row[priceIndex] ?? ""),
    recordId: recordIndex >= 0 ? row[recordIndex] : "",
  })).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].timestamp === parsed[i - 1].timestamp) throw new Error("CSV contains duplicate price timestamps.");
  }
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  return parsed.map((row) => ({
    sourceId: "licensed-market-data", indicatorKey: "silver_spot_usd_oz",
    value: row.price, unit: "USD/oz", observedAt: row.timestamp, publishedAt: null,
    fetchedAt, confidence: 0.98, status: "verified" as const,
    sourceUrl: sourceUrl.toString(),
    sourceRecordId: row.recordId || `silver-spot:${row.timestamp}`,
  }));
}
export class LicensedSilverPriceCsvAdapter implements SourceAdapter {
  readonly sourceId = "licensed-market-data";
  constructor(private readonly csv: string, private readonly options: LicensedPriceCsvOptions) {}
  async fetch(): Promise<Observation[]> {
    return parseLicensedSilverPriceCsv(this.csv, this.options);
  }
}
