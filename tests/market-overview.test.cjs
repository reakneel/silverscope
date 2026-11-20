const test = require("node:test");
const assert = require("node:assert/strict");
const { getMarketOverview } = require("../.test-build/data/market-overview.js");
test("returns a safe unconfigured state when database credentials are absent", async () => {
  const result = await getMarketOverview({ baseUrl: "", serviceRoleKey: "" });
  assert.equal(result.configured, false);
  assert.equal(result.score, null);
});
test("loads latest score, signal and newest observation per indicator", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/scores?")) return { ok: true, json: async () => [{
      score: "66.5", regime: "bullish", coverage: "0.85", confidence: "0.76",
      as_of: "2026-11-20T12:00:00Z", model_version_id: "model-v1",
      component_scores: [{ group: "macro", score: 66.5, coverage: 1, confidence: 0.8 }],
    }] };
    if (url.includes("/signals?")) return { ok: true, json: async () => [{
      direction: "bullish", confidence: "0.76", generated_at: "2026-11-20T12:00:00Z",
      signal_key: "silver-composite-regime", model_version_id: "model-v1",
    }] };
    return { ok: true, json: async () => [
      { source_id: "cftc", indicator_key: "cftc_managed_money_net", value: "3615", unit: "contracts", observed_at: "2026-11-10T00:00:00Z", fetched_at: "2026-11-20T11:00:00Z", status: "verified" },
      { source_id: "cftc", indicator_key: "cftc_managed_money_net", value: "3200", unit: "contracts", observed_at: "2026-11-03T00:00:00Z", fetched_at: "2026-11-13T11:00:00Z", status: "verified" },
      { source_id: "fred", indicator_key: "us_10y_real_yield", value: "1.75", unit: "percent", observed_at: "2026-11-19T00:00:00Z", fetched_at: "2026-11-20T11:00:00Z", status: "verified" },
    ] };
  };
  const result = await getMarketOverview({ baseUrl: "https://db.example", serviceRoleKey: "secret", fetchImpl });
  assert.equal(result.configured, true);
  assert.equal(result.score.score, 66.5);
  assert.equal(result.score.regime, "bullish");
  assert.equal(result.signal.signalKey, "silver-composite-regime");
  assert.equal(result.observations.cftc_managed_money_net.value, 3615);
  assert.equal(result.observations.us_10y_real_yield.value, 1.75);
  assert.equal(result.updatedAt, "2026-11-20T11:00:00.000Z");
});
test("fails closed when the database query fails", async () => {
  const result = await getMarketOverview({
    baseUrl: "https://db.example", serviceRoleKey: "secret",
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.configured, false);
  assert.deepEqual(result.observations, {});
});
