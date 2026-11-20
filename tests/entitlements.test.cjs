const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveEntitlements } = require("../.test-build/billing/entitlements.js");
const now = Date.parse("2026-11-20T12:00:00Z");
test("grants only active and unexpired plan capabilities", () => {
  const pro = resolveEntitlements({ planKey: "pro", status: "active", currentPeriodEnd: "2026-12-20T12:00:00Z" }, now);
  assert.equal(pro.plan, "pro");
  assert.equal(pro.canAccessFullSignals, true);
  assert.equal(pro.canAccessScenarioResearch, false);
  assert.equal(pro.maxAlerts, 10);
  const ultra = resolveEntitlements({ planKey: "ultra", status: "trialing", currentPeriodEnd: "2026-12-20T12:00:00Z" }, now);
  assert.equal(ultra.canAccessApi, true);
  assert.equal(ultra.maxAlerts, 50);
});
test("fails closed for expired, canceled and unknown plans", () => {
  assert.equal(resolveEntitlements({ planKey: "pro", status: "active", currentPeriodEnd: "2026-11-19T12:00:00Z" }, now).plan, "free");
  assert.equal(resolveEntitlements({ planKey: "ultra", status: "canceled" }, now).plan, "free");
  assert.equal(resolveEntitlements({ planKey: "enterprise", status: "active" }, now).plan, "free");
});
