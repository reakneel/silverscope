export interface EquityPoint {
  timestamp: string;
  equity: number;
  benchmarkEquity?: number;
  turnover?: number;
}
export interface BacktestOptions {
  annualRiskFreeRate?: number;
  tradingCostBps?: number;
  periodsPerYear?: number;
}
export interface BacktestMetrics {
  observations: number;
  periods: number;
  totalReturn: number;
  cagr: number | null;
  annualizedVolatility: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number;
  calmarRatio: number | null;
  winRate: number;
  benchmarkReturn: number | null;
  netEquity: number[];
  assumptions: { annualRiskFreeRate: number; tradingCostBps: number; periodsPerYear: number };
}

function sampleDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}
function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite positive number.`);
}

export function calculateBacktestMetrics(points: EquityPoint[], options: BacktestOptions = {}): BacktestMetrics {
  if (points.length < 2) throw new Error("At least two chronological equity points are required.");
  const annualRiskFreeRate = options.annualRiskFreeRate ?? 0;
  const tradingCostBps = options.tradingCostBps ?? 0;
  const periodsPerYear = options.periodsPerYear ?? 252;
  if (!Number.isFinite(annualRiskFreeRate) || annualRiskFreeRate < -1) throw new Error("annualRiskFreeRate must be finite and greater than -1.");
  if (!Number.isFinite(tradingCostBps) || tradingCostBps < 0) throw new Error("tradingCostBps must be finite and non-negative.");
  if (!Number.isFinite(periodsPerYear) || periodsPerYear <= 0) throw new Error("periodsPerYear must be positive.");

  const dates = points.map((point) => Date.parse(point.timestamp));
  for (let i = 0; i < points.length; i++) {
    assertFinitePositive(points[i].equity, "equity");
    if (!Number.isFinite(dates[i])) throw new Error("Every timestamp must be a valid date.");
    if (i > 0 && dates[i] <= dates[i - 1]) throw new Error("Equity points must be strictly chronological and unique.");
    if (points[i].benchmarkEquity !== undefined) assertFinitePositive(points[i].benchmarkEquity, "benchmarkEquity");
    if (points[i].turnover !== undefined && (!Number.isFinite(points[i].turnover) || points[i].turnover < 0)) {
      throw new Error("turnover must be finite and non-negative.");
    }
  }

  const rawReturns = points.slice(1).map((point, index) => point.equity / points[index].equity - 1);
  const netReturns = rawReturns.map((value, index) => {
    const turnover = points[index + 1].turnover ?? 0;
    const cost = turnover * tradingCostBps / 10_000;
    if (value - cost <= -1) throw new Error("Trading costs produce a total loss or negative equity.");
    return value - cost;
  });
  const netEquity = [points[0].equity];
  for (const value of netReturns) netEquity.push(netEquity[netEquity.length - 1] * (1 + value));

  const totalReturn = netEquity[netEquity.length - 1] / netEquity[0] - 1;
  const elapsedYears = (dates[dates.length - 1] - dates[0]) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = elapsedYears > 0 && totalReturn > -1 ? (1 + totalReturn) ** (1 / elapsedYears) - 1 : null;
  const meanReturn = netReturns.reduce((sum, value) => sum + value, 0) / netReturns.length;
  const volatility = sampleDeviation(netReturns);
  const annualizedVolatility = volatility * Math.sqrt(periodsPerYear);
  const periodicRiskFree = Math.pow(1 + annualRiskFreeRate, 1 / periodsPerYear) - 1;
  const excess = netReturns.map((value) => value - periodicRiskFree);
  const sharpeRatio = volatility > 0 ? excess.reduce((sum, value) => sum + value, 0) / excess.length / volatility * Math.sqrt(periodsPerYear) : null;
  const downside = netReturns.map((value) => Math.min(0, value - periodicRiskFree));
  const downsideDeviation = Math.sqrt(downside.reduce((sum, value) => sum + value ** 2, 0) / downside.length);
  const sortinoRatio = downsideDeviation > 0 ? excess.reduce((sum, value) => sum + value, 0) / excess.length / downsideDeviation * Math.sqrt(periodsPerYear) : null;

  let peak = netEquity[0], maxDrawdown = 0;
  for (const value of netEquity) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  }
  const benchmarkPoints = points.filter((point) => point.benchmarkEquity !== undefined);
  const benchmarkReturn = benchmarkPoints.length === points.length
    ? (benchmarkPoints[benchmarkPoints.length - 1].benchmarkEquity as number) / (benchmarkPoints[0].benchmarkEquity as number) - 1
    : null;
  return {
    observations: points.length, periods: netReturns.length, totalReturn,
    cagr, annualizedVolatility,
    sharpeRatio, sortinoRatio, maxDrawdown,
    calmarRatio: cagr !== null && maxDrawdown > 0 ? cagr / maxDrawdown : null,
    winRate: netReturns.filter((value) => value > 0).length / netReturns.length,
    benchmarkReturn, netEquity,
    assumptions: { annualRiskFreeRate, tradingCostBps, periodsPerYear },
  };
}
