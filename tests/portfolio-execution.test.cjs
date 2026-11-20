const test = require("node:test");
const assert = require("node:assert/strict");
const { simulatePortfolioExecution } = require("../.test-build/research/portfolio-execution.js");
const opts = { initialCapital: 100000, maxParticipationRate: 0.5, slippageBps: 1, maxContractsPerContract: 5 };
const bar = (contractId, targetContracts, open = 30, close = 30, volume = 10, multiplier = 5000, initial = 0.1, maintenance = 0.08) => ({
  contractId, targetContracts, open, close, volume, contractMultiplier: multiplier,
  commissionPerContractPerSide: 2, initialMarginRate: initial, maintenanceMarginRate: maintenance,
});
test("executes synchronized multi-contract targets with shared equity and partial fills", () => {
  const result = simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [bar("SIH27", 3), bar("GCZ26", -1, 4000, 4000, 2, 100, 0.08, 0.06)] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", 3, 31, 32), bar("GCZ26", -1, 4010, 4020, 2, 100, 0.08, 0.06)] },
    { timestamp: "2026-01-03", bars: [bar("SIH27", 0, 33, 34), bar("GCZ26", 0, 4020, 4010, 10, 100, 0.08, 0.06)] },
  ], opts);
  assert.ok(result.fills.some((f) => f.contractId === "SIH27" && f.contracts === 3));
  assert.ok(result.fills.some((f) => f.contractId === "GCZ26" && f.contracts === 1));
  assert.equal(result.fullyLiquidated, true);
  assert.equal(result.openPositions.length, 0);
  assert.equal(result.equityCurve.length, 3);
});
test("retains and reports residual target quantity when volume is insufficient", () => {
  const result = simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [bar("SIH27", 4)] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", 4, 30, 30, 2)] },
  ], opts);
  assert.equal(result.fills[0].contracts, 1);
  assert.equal(result.fills[0].remainingContracts, 3);
  assert.equal(result.fullyLiquidated, false);
  assert.equal(result.openPositions[0].contracts, 1);
});
test("requires synchronized marks and stable contract specifications", () => {
  assert.throws(() => simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [bar("SIH27", 1), bar("GCZ26", 1)] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", 1), bar("GCZ26", 1)] },
    { timestamp: "2026-01-03", bars: [bar("SIH27", 1)] },
  ], opts), /Missing mark bar/);
  assert.throws(() => simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [bar("SIH27", 1)] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", 1, 30, 30, 10, 2500)] },
  ], opts), /specification changed/);
});
test("rejects incoherent margin rates, invalid chronology and short positions when disabled", () => {
  assert.throws(() => simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [{ ...bar("SIH27", 0), initialMarginRate: 0.1, maintenanceMarginRate: 0.2 }] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", 0)] },
  ], opts), /Margin rates/);
  assert.throws(() => simulatePortfolioExecution([
    { timestamp: "2026-01-01", bars: [bar("SIH27", -1)] },
    { timestamp: "2026-01-02", bars: [bar("SIH27", -1)] },
  ], { ...opts, allowShort: false }), /Short positions/);
  assert.throws(() => simulatePortfolioExecution([
    { timestamp: "2026-01-02", bars: [bar("SIH27", 0)] },
    { timestamp: "2026-01-01", bars: [bar("SIH27", 0)] },
  ], opts), /strictly increasing/);
});
