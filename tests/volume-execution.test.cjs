const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateVolumeConstrainedOrder } = require("../.test-build/research/volume-execution.js");
test("caps fills by per-bar participation and reports residual quantity", () => {
  const result = simulateVolumeConstrainedOrder(10, [
    { timestamp: "2026-01-01", price: 30, volume: 10 },
    { timestamp: "2026-01-02", price: 31, volume: 15 },
  ], { maxParticipationRate: 0.2, contractMultiplier: 5000, commissionPerContractPerSide: 2, slippageBps: 5 });
  assert.equal(result.filledContracts, 5);
  assert.equal(result.remainingContracts, 5);
  assert.deepEqual(result.fills.map((f) => f.contracts), [2, 3]);
  assert.equal(result.totalCommission, 10);
  assert.ok(result.totalSlippageCost > 0);
});
test("supports sells and validates capacity inputs", () => {
  const result = simulateVolumeConstrainedOrder(-3, [{ timestamp: "2026-01-01", price: 30, volume: 100 }], { maxParticipationRate: 0.1, contractMultiplier: 1, commissionPerContractPerSide: 0, slippageBps: 0 });
  assert.equal(result.fills[0].side, "sell");
  assert.equal(result.remainingContracts, 0);
  assert.throws(() => simulateVolumeConstrainedOrder(1, [], { maxParticipationRate: 0, contractMultiplier: 1, commissionPerContractPerSide: 0, slippageBps: 0 }), /maxParticipationRate/);
});
