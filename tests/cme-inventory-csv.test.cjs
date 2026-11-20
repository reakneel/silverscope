const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCmeSilverStocksCsv } = require("../.test-build/ingestion/cme-inventory-csv.js");

test("aggregates warehouse-level registered and eligible COMEX silver stocks", () => {
  const csv = [
    "Report Date,Depository,Registered (oz),Eligible (oz)",
    "2026-11-19,Warehouse A,1000000,2500000",
    "2026-11-19,Warehouse B,750000,1250000",
  ].join("\n");
  const rows = parseCmeSilverStocksCsv(csv, { fetchedAt: "2026-11-20T10:00:00.000Z" });
  assert.deepEqual(rows.map((row) => row.value), [1750000, 3750000, 5500000]);
  assert.deepEqual(rows.map((row) => row.indicatorKey), [
    "comex_registered_stocks", "comex_eligible_stocks", "comex_total_stocks",
  ]);
  assert.equal(rows[0].observedAt, "2026-11-19T00:00:00.000Z");
  assert.equal(rows[0].publishedAt, null);
  assert.equal(rows[0].sourceId, "cme-comex");
});

test("prefers one official total row instead of adding it to warehouse rows", () => {
  const csv = [
    "Date,Depository,Registered,Eligible",
    "2026-11-19,Warehouse A,100,200",
    "2026-11-19,Warehouse B,300,400",
    "2026-11-19,TOTAL,400,600",
  ].join("\n");
  const rows = parseCmeSilverStocksCsv(csv);
  assert.deepEqual(rows.map((row) => row.value), [400, 600, 1000]);
});

test("rejects duplicate warehouses, multiple dates and ambiguous total rows", () => {
  const duplicate = "Date,Warehouse,Registered,Eligible\n2026-11-19,A,10,20\n2026-11-19,A,10,20";
  assert.throws(() => parseCmeSilverStocksCsv(duplicate), /duplicate warehouse/i);
  const multipleDates = "Date,Warehouse,Registered,Eligible\n2026-11-19,A,10,20\n2026-11-20,B,10,20";
  assert.throws(() => parseCmeSilverStocksCsv(multipleDates), /single CSV import/i);
  const totals = "Date,Warehouse,Registered,Eligible\n2026-11-19,TOTAL A,10,20\n2026-11-19,TOTAL B,10,20";
  assert.throws(() => parseCmeSilverStocksCsv(totals), /multiple total rows/i);
});

test("requires valid dates and explicit registered/eligible columns", () => {
  assert.throws(() => parseCmeSilverStocksCsv("Warehouse,Registered,Eligible\nA,10,20"), /report date/i);
  assert.throws(() => parseCmeSilverStocksCsv("Date,Warehouse,Amount\n2026-11-19,A,10"), /headers/i);
});
