const test = require("node:test");
const assert = require("node:assert/strict");
const { CftcSilverAdapter } = require("../.test-build/ingestion/cftc-adapter.js");
test("fetches only standard COMEX silver futures and computes managed-money net", async () => {
  let requested;
  const adapter = new CftcSilverAdapter(async (url) => {
    requested = new URL(url);
    return { ok: true, status: 200, json: async () => [{
      id: "row-1", cftc_contract_market_code: "084691",
      report_date_as_yyyy_mm_dd: "2026-11-10T00:00:00.000",
      m_money_positions_long_all: "17,182", m_money_positions_short_all: "13,567",
    }, {
      id: "micro", cftc_contract_market_code: "084694",
      report_date_as_yyyy_mm_dd: "2026-11-10T00:00:00.000",
      m_money_positions_long_all: "100", m_money_positions_short_all: "20",
    }] };
  }, () => new Date("2026-11-20T10:00:00.000Z"));
  const rows = await adapter.fetch();
  assert.equal(requested.searchParams.get("$where"), "cftc_contract_market_code='084691'");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 3615);
  assert.equal(rows[0].indicatorKey, "cftc_managed_money_net");
  assert.equal(rows[0].observedAt, "2026-11-10T00:00:00.000Z");
  assert.equal(rows[0].publishedAt, null);
});
test("supports bounded historical pagination and rejects malformed dates", async () => {
  let calls = 0;
  const adapter = new CftcSilverAdapter(async (url) => {
    calls++;
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("$limit"), "2");
    assert.match(parsed.searchParams.get("$where"), /report_date_as_yyyy_mm_dd >= '2026-01-01T00:00:00'/);
    return { ok: true, status: 200, json: async () => calls === 1 ? [
      { id: "1", cftc_contract_market_code: "084691", report_date_as_yyyy_mm_dd: "2026-01-06T00:00:00", m_money_positions_long_all: "10", m_money_positions_short_all: "5" },
      { id: "2", cftc_contract_market_code: "084691", report_date_as_yyyy_mm_dd: "2026-01-13T00:00:00", m_money_positions_long_all: "12", m_money_positions_short_all: "5" },
    ] : [] };
  }, () => new Date("2026-01-20T00:00:00Z"), 2);
  assert.equal((await adapter.fetch("2026-01-01")).length, 2);
  assert.equal(calls, 2);
  await assert.rejects(() => adapter.fetch("bad-date"), /YYYY-MM-DD/);
});
