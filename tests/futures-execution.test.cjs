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

test("requires explicit roll prices, caps positions, enforces short policy and chronology", () => {
  const base = [
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
  ];
  assert.throws(() => simulateFuturesExecution(base.map((b, i) => ({ ...b, contractId: i ? "SIK26" : b.contractId })), options), /rollFromPrice/i);
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

test("closes the expiring contract and opens the next contract without booking the spread as PnL", () => {
  const result = simulateFuturesExecution([
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 31, targetContracts: 1 },
    { timestamp: "2026-01-03", contractId: "SIK26", open: 33, close: 34, rollFromPrice: 31, targetContracts: 1 },
  ], options);
  const rollFills = result.fills.filter((fill) => fill.reason === "roll");
  assert.equal(rollFills.length, 2);
  assert.equal(rollFills[0].contractId, "SIH26");
  assert.equal(rollFills[0].side, "sell");
  assert.equal(rollFills[1].contractId, "SIK26");
  assert.equal(rollFills[1].side, "buy");
  assert.equal(rollFills[0].referencePrice, 31);
  assert.equal(rollFills[1].referencePrice, 33);
  assert.ok(result.finalEquity > 100000);
});

test("enforces initial margin and liquidates below maintenance margin", () => {
  const bars = [
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 1 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 15, targetContracts: 1 },
  ];
  assert.throws(() => simulateFuturesExecution(bars, { ...options, initialMarginRate: 0.8, maintenanceMarginRate: 0.5 }), /initial margin/i);
  const result = simulateFuturesExecution(bars, { ...options, initialMarginRate: 0.5, maintenanceMarginRate: 0.4 });
  const liquidation = result.fills.find((fill) => fill.reason === "margin_liquidation");
  assert.ok(liquidation);
  assert.equal(liquidation.side, "sell");
  assert.equal(result.equityCurve.at(-1).contracts, 0);
  assert.equal(result.equityCurve.at(-1).maintenanceMargin, 0);
});

test("requires coherent margin rates", () => {
  const bars = [
    { timestamp: "2026-01-01", contractId: "SIH26", open: 30, close: 30, targetContracts: 0 },
    { timestamp: "2026-01-02", contractId: "SIH26", open: 30, close: 30, targetContracts: 0 },
  ];
  assert.throws(() => simulateFuturesExecution(bars, { ...options, initialMarginRate: 0.2 }), /supplied together/i);
  assert.throws(() => simulateFuturesExecution(bars, { ...options, initialMarginRate: 0.2, maintenanceMarginRate: 0.3 }), /satisfy/i);
});
