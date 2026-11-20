const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCompositeScore, normalizeZScore } = require("../.test-build/quant/engine.js");
const now = new Date("2026-11-20T12:00:00.000Z");
const feature = (key, group, score, overrides = {}) => ({
  key, group, score, confidence: 0.9, observedAt: now.toISOString(),
  status: "verified", sourceId: "test-source", ...overrides,
});
const fullCoverageRows = () => [
  ...Array.from({length:5},(_,i)=>feature(`inventory-${i}`,"inventory_liquidity",80)),
  ...Array.from({length:5},(_,i)=>feature(`macro-${i}`,"macro",70)),
  ...Array.from({length:2},(_,i)=>feature(`demand-${i}`,"supply_demand",60)),
];
test("withholds score when weighted indicator coverage is below threshold", () => {
  const result = calculateCompositeScore([feature("inventory","inventory_liquidity",80),feature("macro","macro",70)],{},now);
  assert.equal(result.status,"insufficient_data");
  assert.equal(result.score,null);
  assert.equal(result.coverage,0.11);
  assert.equal(result.components.find((item)=>item.group==="inventory_liquidity").coverage,0.2);
});
test("scores only when sufficient weighted indicator coverage spans independent groups", () => {
  const result = calculateCompositeScore(fullCoverageRows(),{},now);
  assert.equal(result.status,"scored");
  assert.equal(result.regime,"bullish");
  assert.equal(result.coverage,0.7);
  assert.ok(result.score > 60 && result.score < 75);
});
test("rejects stale, duplicate and malformed features", () => {
  const result = calculateCompositeScore([
    feature("inventory","inventory_liquidity",80),feature("inventory","inventory_liquidity",90),
    feature("macro","macro",50,{observedAt:"2026-01-01T00:00:00.000Z"}),
    feature("demand","supply_demand",120),
  ],{},now);
  assert.deepEqual(result.rejectedInputs.map((item)=>item.reason),["duplicate_key","stale","score_out_of_range"]);
});
test("estimated inputs receive a confidence haircut", () => {
  const rows=fullCoverageRows();
  const verified=calculateCompositeScore(rows,{},now);
  const estimated=calculateCompositeScore(rows.map((item)=>item.key==="inventory-0"?{...item,status:"estimated"}:item),{},now);
  assert.ok(estimated.confidence < verified.confidence);
});
test("z-score normalization applies direction and rejects zero deviation", () => {
  assert.equal(normalizeZScore(12,10,2,1),65);
  assert.equal(normalizeZScore(12,10,2,-1),35);
  assert.equal(normalizeZScore(12,10,0),null);
});
