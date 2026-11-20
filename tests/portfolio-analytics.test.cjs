const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateAccountValuation, calculateDrawdownSeries, calculateMaxDrawdown, calculateExcessReturn } = require("../.test-build/portfolio/analytics.js");

const holding = (overrides = {}) => ({
  instrumentId: "i1", symbol: "600000", name: "浦发银行", quantity: 100,
  costBasis: 8, importedMarketPrice: 9, importedMarketValue: 900,
  quotePrice: null, quoteStatus: "unavailable", quoteObservedAt: null,
  currency: "CNY", ...overrides,
});

test("uses broker-imported market value and computes unrealized P&L only from known inputs", () => {
  const result = calculateAccountValuation({ holdings: [holding()], cash: 100, currency: "CNY", asOf: "2026-11-20T07:00:00Z" });
  assert.equal(result.account.totalAssets, 1000);
  assert.equal(result.account.status, "complete");
  assert.equal(result.account.completeness, 1);
  assert.equal(result.holdings[0].unrealizedPnl, 100);
  assert.equal(result.holdings[0].unrealizedPnlPct, 12.5);
  assert.equal(result.holdings[0].weightPct, 90);
  assert.equal(result.holdings[0].valuationSource, "broker_snapshot");
});

test("does not invent total assets or weights when a holding lacks a verified price", () => {
  const result = calculateAccountValuation({
    holdings: [holding({ importedMarketValue: null, importedMarketPrice: null, quotePrice: 9, quoteStatus: "stale" })],
    cash: 100, currency: "CNY", asOf: null,
  });
  assert.equal(result.account.totalAssets, null);
  assert.equal(result.account.status, "partial");
  assert.equal(result.holdings[0].marketValue, null);
  assert.equal(result.holdings[0].weightPct, null);
  assert.equal(result.holdings[0].unrealizedPnl, null);
});

test("does not aggregate foreign-currency holdings without an FX conversion", () => {
  const result = calculateAccountValuation({
    holdings: [holding({ currency: "HKD", importedMarketValue: 900 })],
    cash: 100, currency: "CNY", asOf: null,
  });
  assert.equal(result.account.totalAssets, null);
  assert.equal(result.holdings[0].valuationSource, "unavailable");
});

test("supports a verified cash-only account without inventing holdings", () => {
  const result = calculateAccountValuation({ holdings: [], cash: 2500, currency: "CNY", asOf: null });
  assert.equal(result.account.totalAssets, 2500);
  assert.equal(result.account.positionsValue, 0);
  assert.equal(result.account.status, "complete");
  assert.equal(result.account.completeness, 1);
});

test("calculates drawdown from chronological positive NAV observations", () => {
  const series = [
    { asOf: "2026-01-03T00:00:00Z", totalValue: 90 },
    { asOf: "2026-01-01T00:00:00Z", totalValue: 100 },
    { asOf: "2026-01-02T00:00:00Z", totalValue: 80 },
  ];
  const result = calculateDrawdownSeries(series);
  assert.equal(result[0].totalValue, 100);
  assert.equal(result[1].drawdownPct, -20);
  assert.equal(calculateMaxDrawdown(series), -20);
  assert.equal(calculateMaxDrawdown([]), null);
  assert.throws(() => calculateMaxDrawdown([{ asOf: "bad", totalValue: -1 }]), /positive finite/);
});

test("computes portfolio minus benchmark excess returns", () => {
  assert.deepEqual(calculateExcessReturn([
    { asOf: "2026-01-01", portfolioPct: 5, benchmarkPct: 3 },
    { asOf: "2026-01-02", portfolioPct: -2, benchmarkPct: 1 },
  ]), [
    { asOf: "2026-01-01", excessPct: 2 },
    { asOf: "2026-01-02", excessPct: -3 },
  ]);
});
