const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFeatureCalibrations, buildFeatureSignals } = require("../.test-build/quant/features.js");
const { buildSignalSnapshot } = require("../.test-build/quant/signals.js");
const calibration = [{ indicatorKey: "real_yield", group: "macro", mean: 2, standardDeviation: 1, direction: -1 }];
const observation = (value, observedAt = "2026-11-20T00:00:00.000Z") => ({
  sourceId: "fred", indicatorKey: "real_yield", value, unit: "percent", observedAt,
  publishedAt: null, fetchedAt: "2026-11-20T01:00:00.000Z", confidence: 0.9,
  status: "verified", sourceUrl: null, sourceRecordId: null,
});
test("parses valid calibrations and rejects invalid or duplicate keys", () => {
  assert.equal(parseFeatureCalibrations(JSON.stringify(calibration)).length, 1);
  assert.throws(() => parseFeatureCalibrations("{"), /valid JSON/);
  assert.throws(() => parseFeatureCalibrations(JSON.stringify([...calibration, ...calibration])), /Duplicate/);
  assert.throws(() => parseFeatureCalibrations(JSON.stringify([{ ...calibration[0], standardDeviation: 0 }])), /standardDeviation/);
});
test("builds directional normalized features using the latest observation", () => {
  const result = buildFeatureSignals([
    observation(3, "2026-11-19T00:00:00.000Z"), observation(1, "2026-11-20T00:00:00.000Z"),
  ], calibration);
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].score, 65);
  assert.equal(result.skipped.length, 0);
});
test("reports missing observations instead of inventing feature values", () => {
  const result = buildFeatureSignals([], calibration);
  assert.deepEqual(result.skipped, [{ indicatorKey: "real_yield", reason: "no_observation" }]);
});
test("creates only scored signal snapshots and preserves evidence", () => {
  const insufficient = { status: "insufficient_data" };
  assert.equal(buildSignalSnapshot(insufficient), null);
  const score = {
    status: "scored", score: 65, regime: "bullish", confidence: 0.8, coverage: 0.9,
    asOf: "2026-11-20T00:00:00.000Z", modelVersion: "v1", components: [],
    acceptedInputKeys: ["real_yield"], rejectedInputs: [],
    methodology: { minimumCoverage: 0.65, minimumGroups: 2, thresholds: { bearishMaximum: 40, bullishMinimum: 60 } },
  };
  const signal = buildSignalSnapshot(score);
  assert.equal(signal.direction, "bullish");
  assert.equal(signal.evidence.classificationOnly, true);
});
