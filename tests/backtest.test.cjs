const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateBacktestMetrics } = require("../.test-build/research/backtest.js");

test("calculates net returns, drawdown, risk and benchmark metrics", () => {
  const points = [
    { timestamp: "2026-01-01T00:00:00Z", equity: 100, benchmarkEquity: 100 },
    { timestamp: "2026-01-02T00:00:00Z", equity: 110, benchmarkEquity: 105, turnover: 1 },
    { timestamp: "2026-01-03T00:00:00Z", equity: 99, benchmarkEquity: 110, turnover: 0.5 },
  ];
  const metrics = calculateBacktestMetrics(points, { tradingCostBps: 10, periodsPerYear: 252 });
  assert.equal(metrics.observations, 3);
  assert.equal(metrics.periods, 2);
  assert.ok(metrics.netEquity[1] < 110);
  assert.ok(metrics.maxDrawdown > 0.1);
  assert.ok(Math.abs(metrics.benchmarkReturn - 0.1) < 1e-9);
  assert.equal(metrics.assumptions.tradingCostBps, 10);
  assert.ok(metrics.sharpeRatio !== null);
});

test("does not fabricate Sharpe or Calmar ratios when denominators are zero", () => {
  const points = [
    { timestamp: "2026-01-01T00:00:00Z", equity: 100 },
    { timestamp: "2026-01-02T00:00:00Z", equity: 100 },
  ];
  const metrics = calculateBacktestMetrics(points);
  assert.equal(metrics.sharpeRatio, null);
  assert.equal(metrics.sortinoRatio, null);
  assert.equal(metrics.calmarRatio, null);
  assert.equal(metrics.maxDrawdown, 0);
});

test("rejects unordered, duplicate, invalid and non-positive equity data", () => {
  assert.throws(() => calculateBacktestMetrics([{ timestamp: "2026-01-02", equity: 1 }, { timestamp: "2026-01-01", equity: 2 }]), /chronological/i);
  assert.throws(() => calculateBacktestMetrics([{ timestamp: "bad", equity: 1 }, { timestamp: "2026-01-02", equity: 2 }]), /valid date/i);
  assert.throws(() => calculateBacktestMetrics([{ timestamp: "2026-01-01", equity: 0 }, { timestamp: "2026-01-02", equity: 2 }]), /positive/i);
  assert.throws(() => calculateBacktestMetrics([{ timestamp: "2026-01-01", equity: 1 }, { timestamp: "2026-01-02", equity: 2, turnover: -1 }]), /turnover/i);
});
