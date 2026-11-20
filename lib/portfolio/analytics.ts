export type ValuationStatus = "verified" | "stale" | "unavailable";

export interface HoldingInput {
  instrumentId: string;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number | null;
  importedMarketPrice: number | null;
  importedMarketValue: number | null;
  quotePrice: number | null;
  quoteStatus: ValuationStatus;
  quoteObservedAt: string | null;
  currency: string;
}

export interface HoldingMetric extends HoldingInput {
  marketValue: number | null;
  costValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  weightPct: number | null;
  valuationSource: "broker_snapshot" | "verified_quote" | "unavailable";
}

export interface AccountValuation {
  currency: string;
  cash: number | null;
  positionsValue: number | null;
  totalAssets: number | null;
  completeness: number;
  status: "complete" | "partial" | "unavailable";
  asOf: string | null;
}

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function calculateAccountValuation(args: {
  holdings: HoldingInput[];
  cash: number | null;
  currency: string;
  asOf: string | null;
}): { holdings: HoldingMetric[]; account: AccountValuation } {
  const rows = args.holdings.map((holding): HoldingMetric => {
    const validQuantity = finite(holding.quantity) && holding.quantity >= 0;
    const costValue = validQuantity && finite(holding.costBasis) && holding.costBasis >= 0
      ? holding.quantity * holding.costBasis : null;
    const sameCurrency = holding.currency === args.currency;
    const useSnapshot = sameCurrency && validQuantity && finite(holding.importedMarketValue) && holding.importedMarketValue >= 0;
    const useQuote = sameCurrency && validQuantity && !useSnapshot && holding.quoteStatus === "verified" && finite(holding.quotePrice) && holding.quotePrice >= 0;
    const marketValue = !validQuantity ? null
      : useSnapshot ? holding.importedMarketValue
      : useQuote ? holding.quantity * holding.quotePrice! : null;
    const unrealizedPnl = finite(marketValue) && finite(costValue) ? marketValue - costValue : null;
    const unrealizedPnlPct = finite(unrealizedPnl) && finite(costValue) && costValue > 0
      ? (unrealizedPnl / costValue) * 100 : null;
    return {
      ...holding,
      marketValue,
      costValue,
      unrealizedPnl,
      unrealizedPnlPct,
      weightPct: null,
      valuationSource: useSnapshot ? "broker_snapshot" : useQuote ? "verified_quote" : "unavailable",
    };
  });

  const validValues = rows.filter((row) => finite(row.marketValue));
  const positionsValue = rows.length === 0 ? 0 : validValues.length ? validValues.reduce((sum, row) => sum + row.marketValue!, 0) : null;
  const complete = validValues.length === rows.length && finite(args.cash);
  const partial = validValues.length > 0 || finite(args.cash);
  const totalAssets = complete ? positionsValue! + args.cash! : null;
  const denominator = totalAssets !== null && totalAssets > 0 ? totalAssets : null;
  const weighted = rows.map((row) => ({
    ...row,
    weightPct: denominator !== null && finite(row.marketValue) ? (row.marketValue / denominator) * 100 : null,
  }));
  return {
    holdings: weighted,
    account: {
      currency: args.currency,
      cash: finite(args.cash) ? args.cash : null,
      positionsValue,
      totalAssets,
      completeness: (validValues.length + (finite(args.cash) ? 1 : 0)) / (rows.length + 1),
      status: complete ? "complete" : partial ? "partial" : "unavailable",
      asOf: args.asOf,
    },
  };
}

export interface NavObservation { asOf: string; totalValue: number; }
export interface DrawdownPoint { asOf: string; totalValue: number; peak: number; drawdownPct: number; }

export function calculateDrawdownSeries(series: NavObservation[]): DrawdownPoint[] {
  const ordered = [...series].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));
  let peak = 0;
  return ordered.map((point) => {
    if (!Number.isFinite(Date.parse(point.asOf)) || !finite(point.totalValue) || point.totalValue <= 0) {
      throw new Error("NAV observations require valid timestamps and positive finite total values");
    }
    peak = Math.max(peak, point.totalValue);
    return {
      ...point,
      peak,
      drawdownPct: ((point.totalValue - peak) / peak) * 100,
    };
  });
}

export function calculateMaxDrawdown(series: NavObservation[]): number | null {
  if (!series.length) return null;
  return Math.min(...calculateDrawdownSeries(series).map((point) => point.drawdownPct));
}

export interface ReturnObservation { asOf: string; portfolioPct: number; benchmarkPct: number; }
export function calculateExcessReturn(series: ReturnObservation[]): Array<{ asOf: string; excessPct: number }> {
  return series.map((point) => {
    if (!Number.isFinite(point.portfolioPct) || !Number.isFinite(point.benchmarkPct)) {
      throw new Error("Return observations must be finite");
    }
    return { asOf: point.asOf, excessPct: point.portfolioPct - point.benchmarkPct };
  });
}
