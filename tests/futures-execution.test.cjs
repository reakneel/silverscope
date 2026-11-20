const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateFuturesExecution } = require("../.test-build/research/futures-execution.js");

const options = { initialCapital: 100000, contractMultiplier: 5000, commissionPerContractPerSide: 2, slippageBps: 1, maxContracts: 3 };

test("executes close signals at the next open and charges both-side costs", () => {
  const result = simulateFuturesExecution([
    { timestamp: "2026-01-01T00:00:00Z", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02T00:00:00Z", contractId: "SIH26", open: 31, close: 32, targetContracts: 1 },
    { timestamp: "2026-01-03T00:00:00Z", contractId: "SIH26", open: 33, close: 34, targetContracts: 0 },
  ], options);
  assert.equal(result.fills[0].timestamp, "2026-01-02T00:00:00Z");
  assert.equal(result.fills[0].fillPrice, 31.0031);
  assert.equal(result.fills.at(-1).reason, "final_liquidation");
  assert.equal(result.fills.at(-1).side, "sell");
  assert.ok(result.finalEquity > 100000);
  assert.equal(result.equityCurve.at(-1).contracts, 0);
});

test("rejects contract rolls, oversized positions, shorts when disabled and bad chronology", () => {
  const base = [
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
  ];
  assert.throws(() => simulateFuturesExecution(base.map((b, i) => ({ ...b, contractId: i ? "SIK26" : b.contractId })), options), /roll model/i);
  assert.throws(() => simulateFuturesExecution(base.map((b) => ({ ...b, targetContracts: 4 })), options), /maxContracts/i);
  assert.throws(() => simulateFuturesExecution(base.map((b) => ({ ...b, targetContracts: -1 })), { ...options, allowShort: false }), /Short positions/i);
  assert.throws(() => simulateFuturesExecution([...base].reverse(), options), /chronological/i);
});

test("applies adverse execution costs and closes the final position", () => {
  const result = simulateFuturesExecution([
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 30, targetContracts: 0 },
  ], options);
  assert.ok(result.finalEquity < 100000);
  assert.equal(result.fills.length, 2);
  assert.equal(result.equityCurve[0].contracts, 0);
});
