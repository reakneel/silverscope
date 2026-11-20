const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWalkForwardReport, adjustPValuesBonferroni } = require("../.test-build/research/walk-forward-report.js");
const fold1 = [
  { timestamp: "2026-01-01", equity: 100, benchmarkEquity: 100 },
  { timestamp: "2026-01-02", equity: 110, benchmarkEquity: 102 },
  { timestamp: "2026-01-03", equity: 105, benchmarkEquity: 104 },
];
const fold2 = [
  { timestamp: "2026-01-10", equity: 100, benchmarkEquity: 100 },
  { timestamp: "2026-01-11", equity: 102, benchmarkEquity: 101 },
  { timestamp: "2026-01-12", equity: 104, benchmarkEquity: 103 },
];
test("stitches non-overlapping out-of-sample returns without inventing gap returns", () => {
  const report = buildWalkForwardReport([{ foldIndex: 0, testPoints: fold1 }, { foldIndex: 1, testPoints: fold2 }], 10000);
  assert.equal(report.foldCount, 2);
  assert.equal(report.outOfSamplePeriods, 4);
  assert.equal(report.aggregate.cagr, null);
  assert.equal(report.aggregate.calmarRatio, null);
  assert.ok(report.aggregate.totalReturn > 0);
  assert.equal(report.benchmarkCoverage, 1);
  assert.ok(report.aggregate.benchmarkReturn !== null);
});
test("rejects overlapping windows and duplicate fold indices", () => {
  assert.throws(() => buildWalkForwardReport([{ foldIndex: 0, testPoints: fold1 }, { foldIndex: 1, testPoints: [fold1[2], fold2[1]] }], 10000), /overlap/i);
  assert.throws(() => buildWalkForwardReport([{ foldIndex: 0, testPoints: fold1 }, { foldIndex: 0, testPoints: fold2 }], 10000), /unique/i);
});
test("applies Bonferroni family-wise correction across tested hypotheses", () => {
  const adjusted = adjustPValuesBonferroni([0.01, 0.03, 0.2], 0.05);
  assert.deepEqual(adjusted.map((x) => x.adjustedPValue), [0.03, 0.09, 0.6000000000000001]);
  assert.deepEqual(adjusted.map((x) => x.significant), [true, false, false]);
  assert.throws(() => adjustPValuesBonferroni([1.2]), /p-values/);
});
