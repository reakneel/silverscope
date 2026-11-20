const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { previewHuataiCsv } = require("../.test-build/portfolio/huatai-csv.js");

function buffer(text) {
  const value = Buffer.from(text, "utf8");
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

test("previews a holdings snapshot and preserves source values", () => {
  const csv = "证券代码,证券名称,持仓数量,可用股份,成本价,市价,市值\n600000,浦发银行,1000,800,8.25,9.10,9100";
  const result = previewHuataiCsv(buffer(csv), "holdings_snapshot");
  assert.equal(result.totalRows, 1);
  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.rejectedRows.length, 0);
  assert.equal(result.acceptedRows[0].normalized.code, "600000");
  assert.equal(result.acceptedRows[0].normalized.quantity, 1000);
  assert.equal(result.acceptedRows[0].normalized.availableQuantity, 800);
  assert.equal(result.acceptedRows[0].normalized.costPrice, 8.25);
});

test("previews executions with date, direction, amount, fees and taxes", () => {
  const csv = "成交日期,成交时间,证券代码,证券名称,买卖标志,成交数量,成交价格,成交金额,手续费,印花税,成交编号\n2026-11-19,09:31:00,600000,浦发银行,证券买入,100,9.1,910,5,0,HT001";
  const result = previewHuataiCsv(buffer(csv), "executions");
  assert.equal(result.acceptedRows.length, 1);
  const row = result.acceptedRows[0].normalized;
  assert.equal(row.side, "buy");
  assert.equal(row.quantity, 100);
  assert.equal(row.grossAmount, 910);
  assert.equal(row.fees, 5);
  assert.equal(row.sourceTransactionId, "HT001");
  assert.equal(Date.parse(row.tradeAt), Date.parse("2026-11-19T01:31:00.000Z"));
});

test("rejects malformed rows and fails closed on unrecognized headers", () => {
  const csv = "证券代码,证券名称,持仓数量\n600000,浦发银行,100\n600001,上证指数,未知";
  const result = previewHuataiCsv(buffer(csv), "holdings_snapshot");
  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.rejectedRows.length, 1);
  assert.throws(() => previewHuataiCsv(buffer("foo,bar\na,b"), "holdings_snapshot"), /无法识别必需列/);
});

test("supports tab-delimited files and stable row fingerprints", () => {
  const csv = "证券代码\t证券名称\t持仓数量\n000001\t平安银行\t200";
  const first = previewHuataiCsv(buffer(csv), "holdings_snapshot");
  const second = previewHuataiCsv(buffer(csv), "holdings_snapshot");
  assert.equal(first.delimiter, "\t");
  assert.equal(first.acceptedRows[0].fingerprint, second.acceptedRows[0].fingerprint);
});

test("computes SHA-256 over original bytes and enforces file size", () => {
  const csv = "证券代码,持仓数量\n600000,100";
  const bytes = Buffer.from(csv, "utf8");
  const result = previewHuataiCsv(buffer(csv), "holdings_snapshot");
  assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.throws(() => previewHuataiCsv(new ArrayBuffer(10 * 1024 * 1024 + 1), "holdings_snapshot"), /10 MB/);
});

test("interprets China exchange local time and fingerprints normalized records", () => {
  const a = previewHuataiCsv(buffer("证券代码,持仓数量,证券名称\n600000,100,浦发银行"), "holdings_snapshot");
  const b = previewHuataiCsv(buffer("证券名称,证券代码,持仓数量\n浦发银行,600000,100"), "holdings_snapshot");
  assert.equal(a.acceptedRows[0].fingerprint, b.acceptedRows[0].fingerprint);
  const trade = previewHuataiCsv(buffer("成交日期,成交时间,证券代码,买卖标志,成交数量,成交金额\n2026-11-19,09:31:00,600000,买入,100,910"), "executions");
  assert.equal(trade.acceptedRows[0].normalized.tradeAt, "2026-11-19T01:31:00.000Z");
});
