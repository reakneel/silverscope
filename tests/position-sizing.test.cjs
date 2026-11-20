const test = require("node:test");
const assert = require("node:assert/strict");
const { sizeFuturesPosition } = require("../.test-build/research/position-sizing.js");

test("sizes integer contracts from risk budget and stop distance", () => {
  const result = sizeFuturesPosition({ equity: 100000, riskFraction: 0.01, entryPrice: 30, stopPrice: 29, contractMultiplier: 5000, maxContracts: 10 });
  assert.equal(result.riskBudget, 1000);
  assert.equal(result.riskPerContract, 5000);
  assert.equal(result.contracts, 0);
  assert.equal(result.limitingConstraint, "no_trade");
});

test("caps position by margin and max contracts", () => {
  const marginLimited = sizeFuturesPosition({ equity: 100000, riskFraction: 0.5, entryPrice: 30, stopPrice: 29, contractMultiplier: 100, maxContracts: 20, initialMarginRate: 0.5 });
  assert.equal(marginLimited.contracts, 6);
  assert.equal(marginLimited.limitingConstraint, "margin");
  const capped = sizeFuturesPosition({ equity: 100000, riskFraction: 0.5, entryPrice: 30, stopPrice: 29, contractMultiplier: 100, maxContracts: 2 });
  assert.equal(capped.contracts, 2);
  assert.equal(capped.limitingConstraint, "max_contracts");
});

test("rejects invalid risk and stop inputs", () => {
  const base = { equity: 100000, riskFraction: 0.01, entryPrice: 30, stopPrice: 29, contractMultiplier: 100, maxContracts: 10 };
  assert.throws(() => sizeFuturesPosition({ ...base, riskFraction: 0 }), /riskFraction/i);
  assert.throws(() => sizeFuturesPosition({ ...base, stopPrice: 30 }), /differ/i);
  assert.throws(() => sizeFuturesPosition({ ...base, initialMarginRate: 1 }), /initialMarginRate/i);
});
