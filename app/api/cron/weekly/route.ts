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
  try {
    const response = await fetch(`${origin}/api/cron/ingest/cftc`, {
      method: "GET", headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" }, cache: "no-store",
    });
    const body = await response.text();
    return NextResponse.json({ status: response.ok ? "completed" : "failed", job: "cftc", upstreamStatus: response.status, result: body.slice(0, 1200) }, {
      status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ status: "failed", job: "cftc", error: error instanceof Error ? error.message : "Unknown error" }, {
      status: 502, headers: { "Cache-Control": "no-store" },
    });
  }
}
export const POST = GET;
