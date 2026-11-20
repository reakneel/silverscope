const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPointInTimeFeatureSignals } = require("../.test-build/research/point-in-time.js");

const calibration = [{ indicatorKey: "comex_registered_stocks", group: "inventory_liquidity", mean: 100, standardDeviation: 10, direction: -1 }];
const base = {
  sourceId: "cme-comex", indicatorKey: "comex_registered_stocks", value: 90, unit: "oz",
  observedAt: "2026-01-01T00:00:00Z", publishedAt: "2026-01-01T15:00:00Z",
  fetchedAt: "2026-01-02T00:00:00Z", confidence: 0.98, status: "verified",
};

test("only uses verified observations published by the decision timestamp", () => {
  const rows = [
    base,
    { ...base, indicatorKey: "future", observedAt: "2026-01-03T00:00:00Z", publishedAt: "2026-01-03T01:00:00Z" },
    { ...base, indicatorKey: "late", publishedAt: "2026-01-02T01:00:00Z" },
    { ...base, indicatorKey: "unknown", publishedAt: null },
    { ...base, indicatorKey: "estimated", status: "estimated" },
  ];
  const result = buildPointInTimeFeatureSignals(rows, calibration, new Date("2026-01-02T00:00:00Z"));
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].key, "comex_registered_stocks");
  assert.deepEqual(result.skipped.map((row) => row.reason), [
    "not_observed_by_decision_time", "not_published_by_decision_time", "publication_time_unknown", "not_verified",
  ]);
});

test("rejects an invalid decision timestamp", () => {
  assert.throws(() => buildPointInTimeFeatureSignals([], calibration, new Date("invalid")), /valid date/i);
});
