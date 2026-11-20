import type { Observation } from "../data/contracts";
import type { SourceAdapter } from "./runner";

export const FRED_MACRO_SERIES = [
  { id: "DFII10", indicatorKey: "us_10y_real_yield", unit: "percent", title: "10-Year Treasury Inflation-Indexed Security, Constant Maturity Rate" },
  { id: "DTWEXBGS", indicatorKey: "us_dollar_index", unit: "index", title: "Trade Weighted U.S. Dollar Index: Broad, Goods and Services" },
  { id: "DGS10", indicatorKey: "us_10y_nominal_yield", unit: "percent", title: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity" },
] as const;

interface FredApiObservation { date: string; value: string; }
interface FredApiResponse { observations?: FredApiObservation[]; error_message?: string; }

export class FredMacroAdapter implements SourceAdapter {
  readonly sourceId = "fred";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {
    if (!apiKey.trim()) throw new Error("FRED_API_KEY is required.");
  }

  async fetch(since?: string): Promise<Observation[]> {
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      throw new Error("since must use YYYY-MM-DD format.");
    }
    const seriesResults = await Promise.all(FRED_MACRO_SERIES.map((series) => this.fetchSeries(series, since)));
    return seriesResults.flat();
  }

  private async fetchSeries(
    series: (typeof FRED_MACRO_SERIES)[number],
    since?: string,
  ): Promise<Observation[]> {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", series.id);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", since ? "asc" : "desc");
    url.searchParams.set("limit", since ? "100000" : "1");
    if (since) url.searchParams.set("observation_start", since);

    const response = await this.fetchImpl(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`FRED request failed for ${series.id} (HTTP ${response.status}).`);
    }

    const payload = await response.json() as FredApiResponse;
    if (payload.error_message) {
      throw new Error(`FRED rejected ${series.id}: ${payload.error_message.slice(0, 180)}`);
    }

    const fetchedAt = this.clock().toISOString();
    return (payload.observations ?? []).flatMap((row) => {
      const numericValue = Number(row.value);
      if (!row.date || row.value === "." || !Number.isFinite(numericValue)) return [];
      return [{
        sourceId: this.sourceId,
        indicatorKey: series.indicatorKey,
        value: numericValue,
        unit: series.unit,
        observedAt: `${row.date}T00:00:00.000Z`,
        publishedAt: null,
        fetchedAt,
        confidence: 0.98,
        status: "verified" as const,
        sourceUrl: `https://fred.stlouisfed.org/series/${series.id}`,
        sourceRecordId: `${series.id}:${row.date}`,
      }];
    });
  }
}
