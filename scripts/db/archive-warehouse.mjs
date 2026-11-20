const base = (process.env.SILVERSCOPE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!base || !secret) {
  console.error("Set SILVERSCOPE_APP_URL and CRON_SECRET in the local environment.");
  process.exit(1);
}
if (!base.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("SILVERSCOPE_APP_URL must use HTTPS (except local development).");
  process.exit(1);
}
const response = await fetch(`${base}/api/cron/warehouse/archive`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
});
const body = await response.text();
console.log(body);
if (!response.ok) process.exit(1);
