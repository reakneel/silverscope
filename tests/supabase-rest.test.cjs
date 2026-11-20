const test = require("node:test");
const assert = require("node:assert/strict");
const { persistIngestionResult } = require("../.test-build/ingestion/supabase-rest.js");

const baseResult = (overrides = {}) => ({
  sourceId: "fred", status: "succeeded", startedAt: "2026-11-20T10:00:00.000Z",
  completedAt: "2026-11-20T10:00:05.000Z", fetchedCount: 1, acceptedCount: 1,
  rejectedCount: 0, rejected: [],
  observations: [{
    sourceId: "fred", indicatorKey: "us_10y_real_yield", value: 1.75, unit: "percent",
    observedAt: "2026-11-19T00:00:00.000Z", publishedAt: null,
    fetchedAt: "2026-11-20T10:00:05.000Z", confidence: 0.98, status: "verified",
    sourceUrl: "https://fred.stlouisfed.org/series/DFII10", sourceRecordId: "DFII10:2026-11-19",
  }],
  ...overrides,
});
test("persists an ingestion run and idempotent observation rows", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/ingestion_runs")) return { ok: true, status: 201, text: async () => JSON.stringify([{ id: "run-1" }]) };
    if (url.includes("/observations?")) return { ok: true, status: 201, text: async () => JSON.stringify([{ id: "obs-1" }]) };
    return { ok: true, status: 204, text: async () => "" };
  };
  const result = await persistIngestionResult(baseResult(), {
    baseUrl: "https://example.supabase.co/", serviceRoleKey: "service-secret", fetchImpl,
  });
  assert.equal(result.runId, "run-1");
  assert.equal(result.insertedObservations, 1);
  assert.equal(calls.length, 4);
  const observationCall = calls.find((call) => call.url.includes("/observations?"));
  assert.match(observationCall.url, /on_conflict=dedupe_key/);
  assert.match(observationCall.init.headers.Prefer, /resolution=ignore-duplicates/);
  const rows = JSON.parse(observationCall.init.body);
  assert.equal(rows[0].dedupe_key, "fred:us_10y_real_yield:2026-11-19T00:00:00.000Z");
  assert.equal(observationCall.init.headers.apikey, "service-secret");
  const patchCalls = calls.filter((call) => call.init.method === "PATCH");
  assert.equal(patchCalls.length, 2);
  assert.ok(patchCalls.every((call) => !Array.isArray(JSON.parse(call.init.body))));
  assert.ok(patchCalls.some((call) => JSON.parse(call.init.body).enabled === true));
});
test("records failed ingestion runs without inserting observations", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/ingestion_runs")) return { ok: true, status: 201, text: async () => JSON.stringify([{ id: "run-2" }]) };
    return { ok: true, status: 204, text: async () => "" };
  };
  const result = await persistIngestionResult(baseResult({
    status: "failed", fetchedCount: 0, acceptedCount: 0, rejectedCount: 0,
    observations: [], error: "FRED unavailable",
  }), { baseUrl: "https://example.supabase.co", serviceRoleKey: "secret", fetchImpl });
  assert.equal(result.status, "failed");
  assert.equal(calls.length, 2);
  assert.ok(!calls.some((call) => call.url.includes("/observations?")));
  assert.ok(!calls.some((call) => call.url.includes("/data_sources?")));
});
