import type { Observation } from "../data/contracts";
import type { SourceAdapter } from "./runner";

const SOURCE_URL = "https://www.cmegroup.com/solutions/clearing/operations-and-deliveries/nymex-delivery-notices.html";
const NUMBER = /^\d[\d,]*(?:\.\d+)?$/;

function recordsFromCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell.trim()); cell = ""; }
    else if (char === "\n") { row.push(cell.trim()); if (row.some((value) => value !== "")) rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
function key(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function parseOunces(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^\((.*)\)$/, "-$1");
  if (!NUMBER.test(normalized)) return null;
  const number = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function parseDate(value: string | undefined, fallback?: string): string {
  const date = (value || fallback || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("A report date in YYYY-MM-DD format is required.");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("The report date is invalid.");
  return date;
}

export interface CmeSilverStockParseOptions { reportDate?: string; fetchedAt?: string; }

export function parseCmeSilverStocksCsv(csv: string, options: CmeSilverStockParseOptions = {}): Observation[] {
  if (!csv.trim() || csv.length > 2_000_000) throw new Error("CSV is empty or exceeds the 2 MB import limit.");
  const rows = recordsFromCsv(csv);
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = rows[0].map(key);
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = find("reportdate", "date", "asofdate", "reportingdate");
  const warehouseIndex = find("depository", "warehouse", "warehousename", "facility");
  const registeredIndex = find("registered", "registeredoz", "registeredounces", "registeredtotal");
  const eligibleIndex = find("eligible", "eligibleoz", "eligibleounces", "eligibletotal");
  if (warehouseIndex < 0) throw new Error("CSV must include a Depository or Warehouse column to prevent accidental total double-counting.");
  if (registeredIndex < 0 || eligibleIndex < 0) {
    throw new Error("CSV headers must include Registered and Eligible ounce columns.");
  }

  const parsedRows = rows.slice(1).map((row) => {
    const date = parseDate(dateIndex >= 0 ? row[dateIndex] : undefined, options.reportDate);
    const registered = parseOunces(row[registeredIndex]);
    const eligible = parseOunces(row[eligibleIndex]);
    if (registered === null || eligible === null) return null;
    const warehouse = warehouseIndex >= 0 ? (row[warehouseIndex] ?? "").trim() : "";
    return { date, warehouse, registered, eligible };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (!parsedRows.length) throw new Error("No valid warehouse stock rows were found.");
  const dates = [...new Set(parsedRows.map((row) => row.date))];
  if (dates.length !== 1) throw new Error("A single CSV import must contain exactly one report date.");
  const totalRows = parsedRows.filter((row) => /\btotal\b|summary/i.test(row.warehouse));
  const warehouseRows = parsedRows.filter((row) => !/\btotal\b|summary/i.test(row.warehouse));
  let registered: number, eligible: number;
  if (totalRows.length) {
    if (totalRows.length !== 1) throw new Error("CSV contains multiple total rows; refusing to double-count inventory.");
    ({ registered, eligible } = totalRows[0]);
  } else {
    const seen = new Set<string>();
    for (const row of warehouseRows) {
      if (row.warehouse && seen.has(row.warehouse.toLowerCase())) throw new Error("CSV contains a duplicate warehouse row.");
      if (row.warehouse) seen.add(row.warehouse.toLowerCase());
    }
    registered = warehouseRows.reduce((sum, row) => sum + row.registered, 0);
    eligible = warehouseRows.reduce((sum, row) => sum + row.eligible, 0);
  }
  const date = dates[0];
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const common = {
    sourceId: "cme-comex", unit: "oz", observedAt: `${date}T00:00:00.000Z`,
    publishedAt: null, fetchedAt, confidence: 0.98, status: "verified" as const,
    sourceUrl: SOURCE_URL,
  };
  return [
    { ...common, indicatorKey: "comex_registered_stocks", value: registered, sourceRecordId: `silver-stocks:${date}:registered` },
    { ...common, indicatorKey: "comex_eligible_stocks", value: eligible, sourceRecordId: `silver-stocks:${date}:eligible` },
    { ...common, indicatorKey: "comex_total_stocks", value: registered + eligible, sourceRecordId: `silver-stocks:${date}:total` },
  ];
}

export class CmeSilverInventoryCsvAdapter implements SourceAdapter {
  readonly sourceId = "cme-comex";
  constructor(private readonly csv: string, private readonly options: CmeSilverStockParseOptions = {}) {}
  async fetch(): Promise<Observation[]> {
    return parseCmeSilverStocksCsv(this.csv, this.options);
  }
}
