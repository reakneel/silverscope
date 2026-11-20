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
  const jobs = [
    { name: "cftc", path: "/api/cron/ingest/cftc" },
    { name: "warehouse_archive", path: "/api/cron/warehouse/archive" },
  ];
  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const response = await fetch(`${origin}${job.path}`, {
        method: "GET", headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" }, cache: "no-store",
      });
      return { name: job.name, status: response.status, ok: response.ok, body: (await response.text()).slice(0, 1200) };
    } catch (error) {
      return { name: job.name, status: 0, ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }));
  const failed = results.filter((result) => !result.ok);
  return NextResponse.json({ status: failed.length ? "partial_failure" : "completed", checkedAt: new Date().toISOString(), results }, {
    status: failed.length ? 502 : 200, headers: { "Cache-Control": "no-store" },
  });
}
export const POST = GET;
