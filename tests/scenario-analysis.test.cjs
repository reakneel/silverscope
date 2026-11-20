const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluatePortfolioScenarios, evaluateCostSensitivity } = require("../.test-build/research/scenario-analysis.js");
const positions = [
  { contractId: "SIH27", contracts: 2, markPrice: 30, contractMultiplier: 5000, initialMarginRate: 0.1, maintenanceMarginRate: 0.08 },
  { contractId: "GCZ26", contracts: -1, markPrice: 4000, contractMultiplier: 100, initialMarginRate: 0.08, maintenanceMarginRate: 0.06 },
];
test("stress tests long and short contracts with marked PnL and margin shortfalls", () => {
  const [result] = evaluatePortfolioScenarios(100000, positions, [{ id: "metals-shock", priceShockPct: { SIH27: -0.1, GCZ26: 0.05 } }]);
  assert.equal(result.pnlByContract.SIH27, -30000);
  assert.equal(result.pnlByContract.GCZ26, -20000);
  assert.equal(result.pnl, -50000);
  assert.equal(result.stressedEquity, 50000);
  assert.equal(result.grossNotional, 690000);
  assert.equal(result.initialMargin, 60600);
  assert.equal(result.maintenanceMargin, 46800);
  assert.equal(result.initialMarginShortfall, 10600);
  assert.equal(result.maintenanceBreached, false);
});
test("detects maintenance breach and insolvency without hiding negative equity", () => {
  const [result] = evaluatePortfolioScenarios(100000, positions, [{ id: "crash", priceShockPct: { SIH27: -0.2, GCZ26: 0.1 } }]);
  assert.equal(result.stressedEquity, 0);
  assert.equal(result.maintenanceBreached, true);
  assert.equal(result.insolvent, true);
});
test("validates scenario identities and shocks", () => {
  assert.throws(() => evaluatePortfolioScenarios(100000, positions, [{ id: "bad", priceShockPct: { unknown: -0.1 } }]), /Unknown contract/);
  assert.throws(() => evaluatePortfolioScenarios(100000, positions, [{ id: "bad", priceShockPct: { SIH27: -1 } }]), /> -100%/);
});
test("cost sensitivity monotonically charges greater turnover costs", () => {
  const points = [
    { timestamp: "2026-01-01", equity: 100, turnover: 0 },
    { timestamp: "2026-01-02", equity: 110, turnover: 2 },
    { timestamp: "2026-01-03", equity: 120, turnover: 1 },
  ];
  const result = evaluateCostSensitivity(points, [0, 10, 25]);
  assert.ok(result[0].metrics.totalReturn > result[1].metrics.totalReturn);
  assert.ok(result[1].metrics.totalReturn > result[2].metrics.totalReturn);
  assert.throws(() => evaluateCostSensitivity(points, [10, 10]), /unique/);
});
