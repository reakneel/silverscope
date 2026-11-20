/**
 * Provider-agnostic portfolio performance primitives.
 * Inputs are canonical events/observations; adapters are responsible only for mapping source fields.
 * All monetary values in a calculation must already be converted to one reporting currency.
 */

export type CashFlowType = "external_inflow" | "external_outflow";
export interface CashFlow { date: string; amount: number; type: CashFlowType; }
export interface NavPoint { date: string; value: number; }
export interface PerformancePoint extends NavPoint { periodReturnPct: number | null; cumulativeReturnPct: number; }
export interface TradeFill {
  instrumentId: string;
  date: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees?: number;
  taxes?: number;
}
export interface RealizedLotResult {
  instrumentId: string;
  realizedPnl: number;
  matchedQuantity: number;
  unmatchedSellQuantity: number;
  remainingQuantity: number;
}

const valid = (n: number) => Number.isFinite(n);
const assertFinite = (n: number, label: string) => {
  if (!valid(n)) throw new Error(`${label} must be finite`);
};
const time = (date: string) => {
  const t = Date.parse(date);
  if (!Number.isFinite(t)) throw new Error("Invalid date in portfolio series");
  return t;
};

/** Geometric time-weighted return. External flows are removed at period boundaries. */
export function calculateTimeWeightedReturn(nav: NavPoint[], flows: CashFlow[] = []): number | null {
  if (nav.length < 2) return null;
  const ordered = [...nav].sort((a, b) => time(a.date) - time(b.date));
  const orderedFlows = [...flows].sort((a, b) => time(a.date) - time(b.date));
  let growth = 1;
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    assertFinite(previous.value, "NAV");
    assertFinite(current.value, "NAV");
    if (previous.value <= 0) throw new Error("NAV must be positive for time-weighted return");
    const periodFlows = orderedFlows.filter((flow) => time(flow.date) > time(previous.date) && time(flow.date) <= time(current.date));
    const netFlow = periodFlows.reduce((sum, flow) => {
      assertFinite(flow.amount, "Cash flow");
      return sum + (flow.type === "external_inflow" ? flow.amount : -flow.amount);
    }, 0);
    const startAdjusted = previous.value;
    const endAdjusted = current.value - netFlow;
    if (startAdjusted <= 0 || endAdjusted < 0) throw new Error("Invalid flow-adjusted NAV period");
    growth *= endAdjusted / startAdjusted;
  }
  return (growth - 1) * 100;
}

/** Modified Dietz return for periods where exact sub-period valuations are unavailable. */
export function calculateModifiedDietz(
  beginningValue: number,
  endingValue: number,
  flows: Array<CashFlow & { weight?: number }>,
): number | null {
  if (![beginningValue, endingValue].every(valid)) throw new Error("Portfolio values must be finite");
  const weightedFlows = flows.reduce((sum, flow) => {
    assertFinite(flow.amount, "Cash flow");
    const weight = flow.weight ?? 0.5;
    if (!valid(weight) || weight < 0 || weight > 1) throw new Error("Flow weight must be between 0 and 1");
    return sum + (flow.type === "external_inflow" ? 1 : -1) * flow.amount * weight;
  }, 0);
  const netFlows = flows.reduce((sum, flow) => sum + (flow.type === "external_inflow" ? flow.amount : -flow.amount), 0);
  const denominator = beginningValue + weightedFlows;
  if (denominator === 0) return null;
  return ((endingValue - beginningValue - netFlows) / denominator) * 100;
}

/** Annualized money-weighted return (XIRR) using a bounded bisection solver. */
export function calculateXirr(flows: Array<{ date: string; amount: number }>): number | null {
  if (flows.length < 2) return null;
  const ordered = [...flows].sort((a, b) => time(a.date) - time(b.date));
  if (!ordered.some((f) => f.amount < 0) || !ordered.some((f) => f.amount > 0)) return null;
  ordered.forEach((f) => assertFinite(f.amount, "Cash flow"));
  const origin = time(ordered[0].date);
  const npv = (rate: number) => ordered.reduce((sum, f) =>
    sum + f.amount / Math.pow(1 + rate, (time(f.date) - origin) / 86400000 / 365), 0);
  let low = -0.9999;
  let high = 10;
  let fLow = npv(low);
  let fHigh = npv(high);
  while (fLow * fHigh > 0 && high < 1_000_000) {
    high = high * 2 + 1;
    fHigh = npv(high);
  }
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-8) return mid * 100;
    if (fLow * fMid <= 0) { high = mid; fHigh = fMid; }
    else { low = mid; fLow = fMid; }
  }
  return ((low + high) / 2) * 100;
}

/** FIFO realized P&L; buy fees are capitalized, sell fees/taxes reduce proceeds. */
export function calculateFifoRealizedPnl(fills: TradeFill[]): RealizedLotResult[] {
  const queues = new Map<string, Array<{ quantity: number; unitCost: number }>>();
  const totals = new Map<string, { pnl: number; matched: number; unmatched: number }>();
  const ordered = [...fills].sort((a, b) => time(a.date) - time(b.date));
  for (const fill of ordered) {
    for (const [label, value] of Object.entries({ quantity: fill.quantity, price: fill.price, fees: fill.fees ?? 0, taxes: fill.taxes ?? 0 })) {
      assertFinite(value, label);
    }
    if (fill.quantity <= 0 || fill.price < 0 || (fill.fees ?? 0) < 0 || (fill.taxes ?? 0) < 0) throw new Error("Invalid trade fill");
    const queue = queues.get(fill.instrumentId) ?? [];
    const total = totals.get(fill.instrumentId) ?? { pnl: 0, matched: 0, unmatched: 0 };
    if (fill.side === "buy") {
      queue.push({ quantity: fill.quantity, unitCost: fill.price + ((fill.fees ?? 0) + (fill.taxes ?? 0)) / fill.quantity });
    } else {
      let remaining = fill.quantity;
      const netProceedsPerUnit = fill.price - ((fill.fees ?? 0) + (fill.taxes ?? 0)) / fill.quantity;
      while (remaining > 1e-10 && queue.length) {
        const lot = queue[0];
        const matched = Math.min(remaining, lot.quantity);
        total.pnl += matched * (netProceedsPerUnit - lot.unitCost);
        total.matched += matched;
        remaining -= matched;
        lot.quantity -= matched;
        if (lot.quantity <= 1e-10) queue.shift();
      }
      total.unmatched += remaining;
    }
    queues.set(fill.instrumentId, queue);
    totals.set(fill.instrumentId, total);
  }
  return [...totals.entries()].map(([instrumentId, total]) => ({
    instrumentId,
    realizedPnl: total.pnl,
    matchedQuantity: total.matched,
    unmatchedSellQuantity: total.unmatched,
    remainingQuantity: (queues.get(instrumentId) ?? []).reduce((sum, lot) => sum + lot.quantity, 0),
  }));
}

export function calculatePerformanceSeries(nav: NavPoint[], flows: CashFlow[] = []): PerformancePoint[] {
  const ordered = [...nav].sort((a, b) => time(a.date) - time(b.date));
  let cumulative = 1;
  return ordered.map((point, index) => {
    assertFinite(point.value, "NAV");
    if (point.value <= 0) throw new Error("NAV must be positive");
    if (index === 0) return { ...point, periodReturnPct: null, cumulativeReturnPct: 0 };
    const previous = ordered[index - 1];
    const netFlow = flows.filter((f) => time(f.date) > time(previous.date) && time(f.date) <= time(point.date))
      .reduce((sum, f) => sum + (f.type === "external_inflow" ? f.amount : -f.amount), 0);
    const period = (point.value - netFlow) / previous.value - 1;
    cumulative *= 1 + period;
    return { ...point, periodReturnPct: period * 100, cumulativeReturnPct: (cumulative - 1) * 100 };
  });
}

export function calculateAnnualizedVolatility(returnsPct: number[], periodsPerYear = 252): number | null {
  if (returnsPct.length < 2) return null;
  if (!Number.isInteger(periodsPerYear) || periodsPerYear <= 0) throw new Error("periodsPerYear must be a positive integer");
  returnsPct.forEach((r) => assertFinite(r, "Return"));
  const mean = returnsPct.reduce((a, b) => a + b, 0) / returnsPct.length;
  const variance = returnsPct.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returnsPct.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export function calculateSharpeRatio(returnsPct: number[], riskFreeRatePct = 0, periodsPerYear = 252): number | null {
  if (returnsPct.length < 2) return null;
  assertFinite(riskFreeRatePct, "Risk-free rate");
  const excess = returnsPct.map((r) => r - riskFreeRatePct / periodsPerYear);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const vol = calculateAnnualizedVolatility(excess, periodsPerYear);
  return vol && vol > 0 ? (mean * periodsPerYear) / vol : null;
}

export function calculateSortinoRatio(returnsPct: number[], riskFreeRatePct = 0, periodsPerYear = 252): number | null {
  if (returnsPct.length < 2) return null;
  const dailyRf = riskFreeRatePct / periodsPerYear;
  const excess = returnsPct.map((r) => r - dailyRf);
  const downside = excess.map((r) => Math.min(0, r));
  const downsideDeviation = Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / (returnsPct.length - 1)) * Math.sqrt(periodsPerYear);
  if (downsideDeviation === 0) return null;
  return (excess.reduce((a, b) => a + b, 0) / excess.length * periodsPerYear) / downsideDeviation;
}

export function calculateBeta(portfolioReturnsPct: number[], benchmarkReturnsPct: number[]): number | null {
  if (portfolioReturnsPct.length !== benchmarkReturnsPct.length || portfolioReturnsPct.length < 2) return null;
  const meanP = portfolioReturnsPct.reduce((a, b) => a + b, 0) / portfolioReturnsPct.length;
  const meanB = benchmarkReturnsPct.reduce((a, b) => a + b, 0) / benchmarkReturnsPct.length;
  const covariance = portfolioReturnsPct.reduce((sum, p, i) => sum + (p - meanP) * (benchmarkReturnsPct[i] - meanB), 0);
  const variance = benchmarkReturnsPct.reduce((sum, b) => sum + (b - meanB) ** 2, 0);
  return variance > 0 ? covariance / variance : null;
}
