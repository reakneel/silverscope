import { calculateBacktestMetrics, type BacktestMetrics, type BacktestOptions, type EquityPoint } from "./backtest";
export interface WalkForwardTestFold {
  foldIndex: number;
  testPoints: EquityPoint[];
}
export interface WalkForwardFoldSummary {
  foldIndex: number;
  testStart: string;
  testEnd: string;
  observations: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  benchmarkReturn: number | null;
}
export interface WalkForwardReport {
  foldCount: number;
  outOfSamplePeriods: number;
  aggregate: BacktestMetrics;
  folds: WalkForwardFoldSummary[];
  benchmarkCoverage: number;
  annualizationNote: string;
}
/**
 * Concatenates only chronological, non-overlapping test-period returns.
 * CAGR is intentionally null because gaps between test windows are not investable returns.
 */
export function buildWalkForwardReport(
  folds: WalkForwardTestFold[],
  initialCapital: number,
  options: BacktestOptions = {},
): WalkForwardReport {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) throw new Error("initialCapital must be finite and positive.");
  if (!folds.length) throw new Error("At least one out-of-sample fold is required.");
  const sorted = [...folds].sort((a, b) => a.foldIndex - b.foldIndex);
  const seen = new Set<number>();
  const stitched: EquityPoint[] = [];
  const summaries: WalkForwardFoldSummary[] = [];
  const benchmarkReturns: number[] = [];
  let benchmarkPeriods = 0, allBenchmarkPeriods = true, previousTestEnd = Number.NEGATIVE_INFINITY;
  let equity = initialCapital;
  for (const fold of sorted) {
    if (!Number.isInteger(fold.foldIndex) || seen.has(fold.foldIndex)) throw new Error("Fold indices must be unique integers.");
    seen.add(fold.foldIndex);
    const metrics = calculateBacktestMetrics(fold.testPoints, options);
    const start = Date.parse(fold.testPoints[0].timestamp);
    const end = Date.parse(fold.testPoints[fold.testPoints.length - 1].timestamp);
    if (start <= previousTestEnd) throw new Error("Out-of-sample test windows must not overlap and must be chronological.");
    previousTestEnd = end;
    if (!stitched.length) stitched.push({ timestamp: fold.testPoints[0].timestamp, equity });
    for (let i = 1; i < metrics.netEquity.length; i++) {
      const periodReturn = metrics.netEquity[i] / metrics.netEquity[i - 1] - 1;
      equity *= 1 + periodReturn;
      stitched.push({ timestamp: fold.testPoints[i].timestamp, equity });
      const priorBenchmark = fold.testPoints[i - 1].benchmarkEquity;
      const currentBenchmark = fold.testPoints[i].benchmarkEquity;
      if (priorBenchmark === undefined || currentBenchmark === undefined) allBenchmarkPeriods = false;
      else {
        benchmarkReturns.push(currentBenchmark / priorBenchmark - 1);
        benchmarkPeriods++;
      }
    }
    summaries.push({
      foldIndex: fold.foldIndex,
      testStart: fold.testPoints[0].timestamp,
      testEnd: fold.testPoints[fold.testPoints.length - 1].timestamp,
      observations: metrics.observations,
      totalReturn: metrics.totalReturn,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      sortinoRatio: metrics.sortinoRatio,
      benchmarkReturn: metrics.benchmarkReturn,
    });
  }
  const aggregate = calculateBacktestMetrics(stitched, options);
  const benchmarkCoverage = aggregate.periods ? benchmarkPeriods / aggregate.periods : 0;
  if (!allBenchmarkPeriods || benchmarkCoverage !== 1) aggregate.benchmarkReturn = null;
  else aggregate.benchmarkReturn = benchmarkReturns.reduce((value, periodReturn) => value * (1 + periodReturn), 1) - 1;
  aggregate.cagr = null;
  aggregate.calmarRatio = null;
  return {
    foldCount: summaries.length,
    outOfSamplePeriods: aggregate.periods,
    aggregate,
    folds: summaries,
    benchmarkCoverage,
    annualizationNote: "Volatility and Sharpe use periodsPerYear; CAGR is omitted because out-of-sample windows may contain non-invested calendar gaps.",
  };
}
export interface BonferroniResult {
  rawPValue: number;
  adjustedPValue: number;
  significant: boolean;
}
/** Family-wise error control for a declared set of tested hypotheses. */
export function adjustPValuesBonferroni(pValues: number[], alpha = 0.05): BonferroniResult[] {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) throw new Error("alpha must be in (0, 1).");
  for (const p of pValues) if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error("p-values must be finite and in [0, 1].");
  return pValues.map((rawPValue) => {
    const adjustedPValue = Math.min(1, rawPValue * pValues.length);
    return { rawPValue, adjustedPValue, significant: adjustedPValue <= alpha };
  });
}
