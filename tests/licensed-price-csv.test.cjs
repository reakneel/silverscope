const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLicensedSilverPriceCsv } = require("../.test-build/ingestion/licensed-price-csv.js");

test("imports licensed silver spot prices with provider provenance", () => {
  const csv = "Date,Price USD/oz,Record ID\n2026-11-19,31.25,spot-1\n2026-11-20,32.10,spot-2";
  const rows = parseLicensedSilverPriceCsv(csv, {
    providerName: "Licensed Vendor",
    sourceUrl: "https://data.example.test/silver",
    fetchedAt: "2026-11-20T12:00:00.000Z",
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[1].value, 32.1);
  assert.equal(rows[1].indicatorKey, "silver_spot_usd_oz");
  assert.equal(rows[0].sourceId, "licensed-market-data");
  assert.equal(rows[0].sourceRecordId, "spot-1");
  assert.equal(rows[0].publishedAt, null);
});

test("sorts rows chronologically and rejects duplicate timestamps", () => {
  const rows = parseLicensedSilverPriceCsv("Date,Price\n2026-11-20,32\n2026-11-19,31", {
    providerName: "Vendor", sourceUrl: "https://vendor.example/data",
  });
  assert.ok(Date.parse(rows[0].observedAt) < Date.parse(rows[1].observedAt));
  assert.throws(() => parseLicensedSilverPriceCsv("Date,Price\n2026-11-20,32\n2026-11-20,33", {
    providerName: "Vendor", sourceUrl: "https://vendor.example/data",
  }), /duplicate/i);
});

test("requires provider identity, HTTPS source URL and valid prices", () => {
  assert.throws(() => parseLicensedSilverPriceCsv("Date,Price\n2026-11-20,32", {
    providerName: "", sourceUrl: "https://vendor.example/data",
  }), /provider name/i);
  assert.throws(() => parseLicensedSilverPriceCsv("Date,Price\n2026-11-20,32", {
    providerName: "Vendor", sourceUrl: "http://vendor.example/data",
  }), /HTTPS/i);
  assert.throws(() => parseLicensedSilverPriceCsv("Date,Price\n2026-11-20,-1", {
    providerName: "Vendor", sourceUrl: "https://vendor.example/data",
  }), /positive numeric/i);
});
