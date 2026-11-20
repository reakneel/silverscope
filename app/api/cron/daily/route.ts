import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = new URL(request.url).origin;
  const weekday = new Date().getUTCDay() >= 1 && new Date().getUTCDay() <= 5;
  const jobs = [
    ...(weekday ? [{ name: "fred", path: "/api/cron/ingest/fred" }] : []),
    { name: "source_health", path: "/api/cron/monitor/sources" },
    { name: "data_quality", path: "/api/cron/monitor/quality" },
  ];
  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const response = await fetch(`${origin}${job.path}`, {
        method: "GET", headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.text();
      return { name: job.name, status: response.status, ok: response.ok, body: body.slice(0, 1200) };
    } catch (error) {
      return { name: job.name, status: 0, ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }));
  const failed = results.filter((result) => !result.ok);
  return NextResponse.json({
    status: failed.length ? "partial_failure" : "completed",
    checkedAt: new Date().toISOString(), scheduledJobs: results.length, failedJobs: failed.length, results,
    note: "FRED runs on weekdays; source-health and data-quality monitoring run daily.",
  }, { status: failed.length ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
export const POST = GET;
