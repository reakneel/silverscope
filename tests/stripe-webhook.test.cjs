const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { verifyStripeSignature } = require("../.test-build/billing/stripe-webhook.js");
const secret = "whsec_test_secret";
const now = 1795176000;
const body = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
function header(timestamp, payload = body) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}
test("verifies signed Stripe webhook payloads", () => {
  assert.equal(verifyStripeSignature(body, header(now), secret, now), true);
});
test("rejects tampered payloads, wrong secrets and stale signatures", () => {
  assert.equal(verifyStripeSignature(body + " ", header(now), secret, now), false);
  assert.equal(verifyStripeSignature(body, header(now), "wrong", now), false);
  assert.equal(verifyStripeSignature(body, header(now - 1000), secret, now), false);
  assert.equal(verifyStripeSignature(body, null, secret, now), false);
});
