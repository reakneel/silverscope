const test = require("node:test");
const assert = require("node:assert/strict");
const { FredMacroAdapter } = require("../.test-build/ingestion/fred-adapter.js");

test("maps FRED macro series to traceable observations and ignores missing values", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url));
    const seriesId = new URL(url).searchParams.get("series_id");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        observations: [
          { date: "2026-11-19", value: seriesId === "DGS10" ? "4.12" : "1.75" },
          { date: "2026-11-18", value: "." },
        ],
      }),
    };
  };
  const adapter = new FredMacroAdapter("test-api-key", fetchImpl, () => new Date("2026-11-20T12:00:00.000Z"));
  const rows = await adapter.fetch();
  assert.equal(calls.length, 3);
  assert.equal(rows.length, 3);
  assert.equal(rows.find((row) => row.indicatorKey === "us_10y_real_yield").value, 1.75);
  assert.equal(rows.find((row) => row.indicatorKey === "us_10y_nominal_yield").value, 4.12);
  assert.equal(rows[0].status, "verified");
  assert.equal(rows[0].publishedAt, null);
  assert.equal(rows[0].observedAt, "2026-11-19T00:00:00.000Z");
  assert.ok(rows[0].sourceUrl.includes("fred.stlouisfed.org/series/"));
  assert.ok(calls.every((url) => url.searchParams.get("api_key") === "test-api-key"));
});

test("supports date-bounded history requests and validates dates", async () => {
  let requestUrl;
  const fetchImpl = async (url) => {
    requestUrl = new URL(url);
    return { ok: true, status: 200, json: async () => ({ observations: [] }) };
  };
  const adapter = new FredMacroAdapter("test-api-key", fetchImpl);
  await adapter.fetch("2026-01-01");
  assert.equal(requestUrl.searchParams.get("observation_start"), "2026-01-01");
  assert.equal(requestUrl.searchParams.get("sort_order"), "asc");
  assert.equal(requestUrl.searchParams.get("limit"), "100000");
  await assert.rejects(() => adapter.fetch("yesterday"), /YYYY-MM-DD/);
});

test("does not leak API keys in HTTP error messages", async () => {
  const fetchImpl = async () => ({ ok: false, status: 403 });
  const adapter = new FredMacroAdapter("private-key", fetchImpl);
  await assert.rejects(() => adapter.fetch(), (error) => {
    assert.match(error.message, /HTTP 403/);
    assert.equal(error.message.includes("private-key"), false);
    return true;
  });
});
