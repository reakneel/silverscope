const test = require("node:test");
const assert = require("node:assert/strict");
const { validateObservation } = require("../.test-build/data/quality.js");
const now = new Date("2026-11-20T12:00:00.000Z");
const observation = (overrides = {}) => ({
  sourceId:"fred", indicatorKey:"real_yield", value:1.5, unit:"percent",
  observedAt:"2026-11-19T12:00:00.000Z", publishedAt:"2026-11-19T13:00:00.000Z",
  fetchedAt:"2026-11-20T11:00:00.000Z", confidence:0.9, status:"verified", ...overrides,
});
test("accepts a fresh, traceable observation", () => {
  assert.equal(validateObservation(observation(),undefined,now).valid,true);
});
test("rejects stale observations", () => {
  const result=validateObservation(observation({observedAt:"2026-08-01T00:00:00.000Z"}),undefined,now);
  assert.equal(result.valid,false); assert.ok(result.issues.some((issue)=>issue.code==="OBSERVATION_STALE"));
});
test("rejects unavailable status and low confidence", () => {
  assert.equal(validateObservation(observation({status:"unavailable"}),undefined,now).valid,false);
  assert.equal(validateObservation(observation({confidence:0.1}),undefined,now).valid,false);
});
test("rejects publication timestamp after fetch time", () => {
  const result=validateObservation(observation({publishedAt:"2026-11-21T00:00:00.000Z"}),undefined,now);
  assert.ok(result.issues.some((issue)=>issue.code==="PUBLICATION_AFTER_FETCH"));
});
