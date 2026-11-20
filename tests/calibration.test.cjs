const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveCalibrationPreviews } = require("../.test-build/quant/calibration.js");
const definition = { indicatorKey: "net", group: "positioning", direction: 1 };
const row = (value, status = "verified") => ({
  sourceId: "cftc", indicatorKey: "net", value, unit: "contracts",
  observedAt: "2026-11-10T00:00:00.000Z", publishedAt: null,
  fetchedAt: "2026-11-20T00:00:00.000Z", confidence: 0.98, status,
});
test("derives sample mean and sample standard deviation from verified history", () => {
  const result = deriveCalibrationPreviews([row(1), row(2), row(3)], [definition], 3)[0];
  assert.equal(result.ready, true);
  assert.equal(result.mean, 2);
  assert.equal(result.standardDeviation, 1);
});
test("does not derive calibration from too few or non-verified observations", () => {
  const result = deriveCalibrationPreviews([row(1), row(2), row(3, "estimated")], [definition], 3)[0];
  assert.equal(result.ready, false);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.reason, "insufficient_verified_history");
});
test("rejects zero variance rather than emitting a fake normalization", () => {
  const result = deriveCalibrationPreviews([row(5), row(5), row(5)], [definition], 3)[0];
  assert.equal(result.ready, false);
  assert.equal(result.reason, "zero_or_invalid_variance");
});
