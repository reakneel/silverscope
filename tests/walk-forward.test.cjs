const test = require("node:test");
const assert = require("node:assert/strict");
const { createWalkForwardFolds } = require("../.test-build/research/walk-forward.js");
const rows = Array.from({ length: 12 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), value: index,
}));

test("creates expanding folds with an embargo gap and no train/test leakage", () => {
  const folds = createWalkForwardFolds(rows, { minimumTrainSize: 4, testSize: 2, stepSize: 2, embargoSize: 1 });
  assert.equal(folds.length, 4);
  assert.equal(folds[0].train.length, 4);
  assert.equal(folds[0].test.length, 2);
  assert.ok(Date.parse(folds[0].trainEnd) < Date.parse(folds[0].testStart));
  assert.equal(folds[1].train.length, 6);
});

test("supports rolling windows and rejects unordered input", () => {
  const folds = createWalkForwardFolds(rows, { minimumTrainSize: 4, testSize: 2, window: "rolling" });
  assert.equal(folds[1].train.length, 4);
  assert.throws(() => createWalkForwardFolds([...rows].reverse(), { minimumTrainSize: 4, testSize: 2 }), /chronological/i);
});
