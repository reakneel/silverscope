const test = require("node:test");
const assert = require("node:assert/strict");
const { previewUniversalImport } = require("../.test-build/portfolio/universal-import.js");

test("universal holdings parser maps common Chinese and English headers", () => {
  const csv = ["Ticker,Name,Shares,Avg Cost,Market Value,Currency", "AAPL,Apple,10,150,1800,USD"].join(String.fromCharCode(10));
  const result = previewUniversalImport(new TextEncoder().encode(csv).buffer, "holdings_snapshot");
  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.acceptedRows[0].normalized.symbol, "AAPL");
  assert.equal(result.acceptedRows[0].normalized.quantity, 10);
  assert.equal(result.acceptedRows[0].normalized.currency, "USD");
});

test("universal execution parser maps common Chinese trade direction", () => {
  const csv = ["证券代码,交易日期,方向,成交数量,成交金额", "600000,2026-01-02,买入,100,1000"].join(String.fromCharCode(10));
  const result = previewUniversalImport(new TextEncoder().encode(csv).buffer, "executions");
  assert.equal(result.acceptedRows[0].normalized.side, "buy");
});

test("universal parser supports explicit column mapping for arbitrary exports", () => {
  const csv = ["Instrument,Units,Valuation", "XYZ,5,100"].join(String.fromCharCode(10));
  const result = previewUniversalImport(new TextEncoder().encode(csv).buffer, "holdings_snapshot", {
    symbol: "Instrument", quantity: "Units", marketValue: "Valuation",
  });
  assert.equal(result.acceptedRows[0].normalized.symbol, "XYZ");
});

test("cash ledger accepts a balance column without treating it as a cash flow", () => {
  const csv = ["Date,Currency,Cash Balance", "2026-01-02,CNY,12500"].join(String.fromCharCode(10));
  const result = previewUniversalImport(new TextEncoder().encode(csv).buffer, "cash_ledger");
  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.acceptedRows[0].normalized.cashBalance, 12500);
});
