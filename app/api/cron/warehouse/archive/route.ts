import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  try {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/archive_old_observations`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_before: cutoff, p_batch_size: 5000, p_max_batches: 20 }), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Warehouse archive RPC failed (HTTP ${response.status}): ${(await response.text()).slice(0, 240)}`);
    const moved = await response.json();
    return NextResponse.json({ status: "completed", cutoff, archivedRows: Number(moved ?? 0), note: "Rows were moved to monthly partitions in the same PostgreSQL database; this improves lifecycle management but does not reduce total database storage." });
  } catch (error) {
    return NextResponse.json({ error: "warehouse_archive_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
export const POST = GET;
