const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateTimeWeightedReturn, calculateModifiedDietz, calculateXirr,
  calculateFifoRealizedPnl, calculatePerformanceSeries,
  calculateAnnualizedVolatility, calculateSharpeRatio, calculateSortinoRatio, calculateBeta,
} = require("../.test-build/portfolio/performance.js");

test("time-weighted return removes external deposits from performance", () => {
  const result = calculateTimeWeightedReturn([
    { date: "2026-01-01", value: 100 },
    { date: "2026-01-02", value: 210 },
  ], [{ date: "2026-01-02", amount: 100, type: "external_inflow" }]);
  assert.equal(result, 10);
});

test("Modified Dietz supports weighted external cash flows", () => {
  assert.equal(calculateModifiedDietz(100, 160, [
    { date: "2026-01-10", amount: 50, type: "external_inflow", weight: 0.5 },
  ]), 8);
});

test("XIRR computes annualized money-weighted return", () => {
  const result = calculateXirr([
    { date: "2025-01-01", amount: -100 },
    { date: "2026-01-01", amount: 110 },
  ]);
  assert.ok(result !== null && Math.abs(result - 10) < 0.02);
});

test("FIFO realized P&L capitalizes buy fees and subtracts sell costs", () => {
  const result = calculateFifoRealizedPnl([
    { instrumentId: "A", date: "2026-01-01", side: "buy", quantity: 10, price: 10, fees: 2 },
    { instrumentId: "A", date: "2026-01-02", side: "sell", quantity: 6, price: 12, fees: 1, taxes: 1 },
  ])[0];
  assert.equal(result.matchedQuantity, 6);
  assert.equal(result.remainingQuantity, 4);
  assert.equal(result.unmatchedSellQuantity, 0);
  assert.ok(Math.abs(result.realizedPnl - 8.8) < 1e-10);
});

test("performance series computes cash-flow adjusted periodic and cumulative returns", () => {
  const result = calculatePerformanceSeries([
    { date: "2026-01-01", value: 100 },
    { date: "2026-01-02", value: 220 },
    { date: "2026-01-03", value: 231 },
  ], [{ date: "2026-01-02", amount: 100, type: "external_inflow" }]);
  assert.equal(result[1].periodReturnPct, 10);
  assert.equal(result[2].cumulativeReturnPct, 15.500000000000014);
});

test("risk metrics handle zero variance and benchmark beta", () => {
  assert.equal(calculateAnnualizedVolatility([1, 1, 1]), 0);
  assert.equal(calculateSharpeRatio([1, 1, 1]), null);
  assert.equal(calculateSortinoRatio([1, 2, 3]), null);
  assert.equal(calculateBeta([2, 4, 6], [1, 2, 3]), 2);
});
