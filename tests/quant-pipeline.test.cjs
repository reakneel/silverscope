const test = require("node:test");
const assert = require("node:assert/strict");
const { persistQuantSnapshot } = require("../.test-build/quant/supabase-pipeline.js");
const score = {
  modelVersion: "model-v1", status: "scored", score: 67, regime: "bullish",
  coverage: 0.85, confidence: 0.78, asOf: "2026-11-20T12:00:00.000Z",
  components: [], acceptedInputKeys: ["real_yield", "managed_money_net"], rejectedInputs: [],
  methodology: { minimumCoverage: 0.65, minimumGroups: 2, thresholds: { bearishMaximum: 40, bullishMinimum: 60 } },
};
const signal = {
  signalKey: "silver-composite-regime", horizon: "swing", direction: "bullish",
  confidence: 0.78, evidence: { classificationOnly: true },
  invalidationConditions: ["coverage falls"], generatedAt: "2026-11-20T12:00:00.000Z",
};
test("persists a score and evidence-linked signal with stable snapshot key", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/scores?")) return { ok: true, status: 201, text: async () => JSON.stringify([{ id: "score-1" }]) };
    if (url.includes("/signals?")) return { ok: true, status: 201, text: async () => JSON.stringify([{ id: "signal-1" }]) };
    return { ok: true, status: 204, text: async () => "" };
  };
  const result = await persistQuantSnapshot({ baseUrl: "https://db.example", serviceRoleKey: "secret", fetchImpl }, score, signal, "stable-key");
  assert.equal(result.scoreId, "score-1");
  assert.equal(result.signalRows, 1);
  assert.equal(result.snapshotKey, "stable-key");
  const scoreBody = JSON.parse(calls[0].init.body);
  const signalBody = JSON.parse(calls[1].init.body)[0];
  assert.equal(scoreBody.snapshot_key, "stable-key");
  assert.equal(signalBody.score_id, "score-1");
  assert.equal(signalBody.snapshot_key, "stable-key");
});
test("resolves an existing score and ignores duplicate signal snapshots on retry", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/scores?on_conflict=")) return { ok: true, status: 201, text: async () => "[]" };
    if (url.includes("/scores?select=")) return { ok: true, status: 200, text: async () => JSON.stringify([{ id: "existing-score" }]) };
    if (url.includes("/signals?")) return { ok: true, status: 201, text: async () => "[]" };
    return { ok: true, status: 204, text: async () => "" };
  };
  const result = await persistQuantSnapshot({ baseUrl: "https://db.example", serviceRoleKey: "secret", fetchImpl }, score, signal, "stable-key");
  assert.equal(result.scoreId, "existing-score");
  assert.equal(result.signalRows, 0);
  assert.equal(calls.length, 3);
});
