const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateSourceHealth, summarizeSourceHealth } = require("../.test-build/monitoring/source-health.js");
const now = "2026-11-20T12:00:00Z";
const base = { sourceId: "fred", enabled: true, licenseStatus: "public_api", expectedIntervalMs: 24 * 60 * 60 * 1000, lastSuccessAt: "2026-11-20T00:00:00Z", lastAttemptAt: "2026-11-20T00:01:00Z", lastRunStatus: "succeeded", now };
test("classifies healthy, delayed and stale sources from explicit cadence", () => {
  assert.equal(evaluateSourceHealth(base).status, "healthy");
  assert.equal(evaluateSourceHealth({ ...base, lastSuccessAt: "2026-11-19T00:00:00Z" }).status, "delayed");
  assert.equal(evaluateSourceHealth({ ...base, lastSuccessAt: "2026-11-17T00:00:00Z" }).status, "stale");
});
test("fails closed for disabled, unlicensed, never-successful and failed sources", () => {
  assert.equal(evaluateSourceHealth({ ...base, enabled: false }).status, "disabled");
  assert.equal(evaluateSourceHealth({ ...base, licenseStatus: "unverified" }).status, "blocked");
  assert.equal(evaluateSourceHealth({ ...base, lastSuccessAt: null, lastAttemptAt: null, lastRunStatus: null }).status, "never_succeeded");
  assert.equal(evaluateSourceHealth({ ...base, lastSuccessAt: null, lastAttemptAt: now, lastRunStatus: "failed" }).status, "failed");
});
test("marks partial and failed latest attempts degraded while preserving recent success", () => {
  assert.equal(evaluateSourceHealth({ ...base, lastRunStatus: "partial" }).status, "degraded");
  assert.equal(evaluateSourceHealth({ ...base, lastRunStatus: "failed" }).status, "degraded");
});
test("summarizes counts and alerts and rejects invalid timing policies", () => {
  const results = [evaluateSourceHealth(base), evaluateSourceHealth({ ...base, enabled: false }), evaluateSourceHealth({ ...base, licenseStatus: "restricted" })];
  const summary = summarizeSourceHealth(results, now);
  assert.equal(summary.total, 3);
  assert.equal(summary.healthy, 1);
  assert.equal(summary.disabled, 1);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.alerts.length, 2);
  assert.throws(() => evaluateSourceHealth({ ...base, expectedIntervalMs: 0 }), /expectedIntervalMs/);
  assert.throws(() => evaluateSourceHealth({ ...base, lastSuccessAt: "2026-11-21T00:00:00Z" }), /future/);
});
