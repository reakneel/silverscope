const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatePortfolioRisk } = require("../.test-build/research/portfolio-risk.js");
const positions = [
  { contractId: "SIH27", contracts: 2, markPrice: 30, contractMultiplier: 5000, initialMarginRate: 0.1, maintenanceMarginRate: 0.08, riskGroup: "metals" },
  { contractId: "GCZ26", contracts: -1, markPrice: 4000, contractMultiplier: 100, initialMarginRate: 0.08, maintenanceMarginRate: 0.06, riskGroup: "metals" },
];
test("aggregates signed and gross notional with conservative additive margin", () => {
  const result = calculatePortfolioRisk(100000, positions);
  assert.equal(result.grossNotional, 700000);
  assert.equal(result.netNotional, -100000);
  assert.equal(result.initialMargin, 62000);
  assert.equal(result.maintenanceMargin, 48000);
  assert.equal(result.riskGroups.metals, 700000);
  assert.equal(result.marginUtilization, 0.62);
  assert.equal(result.withinLimits, true);
});
test("reports independent account and concentration limit breaches", () => {
  const result = calculatePortfolioRisk(100000, positions, { maxGrossNotional: 500000, maxAbsoluteNetNotional: 50000, maxInitialMargin: 40000, maxContractsByInstrument: 1, maxRiskGroupGrossNotional: 600000 });
  assert.deepEqual(result.breaches, ["maxGrossNotional", "maxAbsoluteNetNotional", "maxInitialMargin", "maxContractsByInstrument", "maxRiskGroupGrossNotional"]);
  assert.equal(result.withinLimits, false);
});
test("rejects duplicate contracts and incoherent margin inputs", () => {
  assert.throws(() => calculatePortfolioRisk(1000, [positions[0], positions[0]]), /unique/);
  assert.throws(() => calculatePortfolioRisk(1000, [{ ...positions[0], maintenanceMarginRate: 0.2 }]), /maintenanceMarginRate/);
});
