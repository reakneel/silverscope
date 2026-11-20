import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_OBSERVATION_POLICY } from "@/lib/data/quality";
import { CmeSilverInventoryCsvAdapter } from "@/lib/ingestion/cme-inventory-csv";
import { runIngestion } from "@/lib/ingestion/runner";
import { persistIngestionResult } from "@/lib/ingestion/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("text/plain")) {
    return NextResponse.json({ error: "csv_content_type_required" }, { status: 415 });
  }
  const csv = await request.text();
  if (!csv.trim() || csv.length > 2_000_000) {
    return NextResponse.json({ error: "invalid_csv_size", maximumBytes: 2_000_000 }, { status: 413 });
  }
  const reportDate = new URL(request.url).searchParams.get("reportDate") ?? undefined;
  const result = await runIngestion(new CmeSilverInventoryCsvAdapter(csv, { reportDate }), {
    policy: { ...DEFAULT_OBSERVATION_POLICY, maxAgeHours: 24 * 365 * 50 },
  });
  if (result.status === "failed") {
    return NextResponse.json({ error: "cme_inventory_import_failed", message: result.error }, { status: 422 });
  }
  try {
    const persisted = await persistIngestionResult(result, { baseUrl, serviceRoleKey });
    return NextResponse.json({
      ...persisted, fetchedObservations: result.fetchedCount,
      rejectedObservations: result.rejectedCount, completedAt: result.completedAt,
      source: "CME Group Silver Stocks report (manual CSV conversion)",
    });
  } catch (error) {
    return NextResponse.json({
      error: "ingestion_persistence_failed",
      message: error instanceof Error ? error.message : "Unknown persistence error",
      ingestionStatus: result.status,
    }, { status: 502 });
  }
}
