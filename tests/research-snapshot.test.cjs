const test = require("node:test");
const assert = require("node:assert/strict");
const { canonicalJson, createResearchSnapshot, createExperimentManifest } = require("../.test-build/research/snapshot.js");
const observation = {
  sourceId: "test-source", indicatorKey: "silver_inventory", value: 100, unit: "tonnes",
  observedAt: "2026-01-01T00:00:00Z", publishedAt: "2026-01-02T00:00:00Z",
  fetchedAt: "2026-01-02T01:00:00Z", confidence: 0.95, status: "verified",
  sourceRecordId: "row-1",
};
const input = {
  datasetId: "silver-history-v1", decisionTime: "2026-01-03T00:00:00Z",
  modelVersion: "model-1", strategyVersion: "strategy-1",
  parameters: { z: 2, a: 1 }, assumptions: { slippageBps: 5 }, observations: [observation],
};
test("creates deterministic canonical snapshots independent of object key order", () => {
  const a = createResearchSnapshot(input);
  const b = createResearchSnapshot({ ...input, parameters: { a: 1, z: 2 } });
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.payload.observations.length, 1);
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});
test("rejects unknown publication time, unverified and future/unavailable observations", () => {
  assert.throws(() => createResearchSnapshot({ ...input, observations: [{ ...observation, publishedAt: null }] }), /publishedAt/);
  assert.throws(() => createResearchSnapshot({ ...input, observations: [{ ...observation, status: "estimated" }] }), /verified/);
  assert.throws(() => createResearchSnapshot({ ...input, observations: [{ ...observation, fetchedAt: "2026-01-04T00:00:00Z" }] }), /available/);
  assert.throws(() => createResearchSnapshot({ ...input, observations: [{ ...observation, publishedAt: "2026-01-04T00:00:00Z" }] }), /available/);
});
test("rejects duplicate source observation identities", () => {
  assert.throws(() => createResearchSnapshot({ ...input, observations: [observation, observation] }), /Duplicate observation/);
});
test("creates a stable versioned experiment manifest", () => {
  const a = createExperimentManifest({ id: "mean-reversion-v1", hypothesis: "test hypothesis", strategyVersion: "1", modelVersion: "m1", parameters: { threshold: 1 }, assumptions: { fee: 2 } });
  const b = createExperimentManifest({ id: "mean-reversion-v1", hypothesis: "test hypothesis", strategyVersion: "1", modelVersion: "m1", parameters: { threshold: 1 }, assumptions: { fee: 2 } });
  assert.equal(a.manifestSha256, b.manifestSha256);
  assert.equal(a.schemaVersion, "silverscope-experiment/1");
});
test("rejects undefined and non-finite snapshot parameters", () => {
  assert.throws(() => canonicalJson({ bad: undefined }), /undefined/);
  assert.throws(() => canonicalJson({ bad: Number.NaN }), /non-finite/);
});
