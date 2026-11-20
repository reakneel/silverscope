import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_OBSERVATION_POLICY } from "@/lib/data/quality";
import { CftcSilverAdapter } from "@/lib/ingestion/cftc-adapter";
import { runIngestion } from "@/lib/ingestion/runner";
import { persistIngestionResult } from "@/lib/ingestion/supabase-rest";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const since = new URL(request.url).searchParams.get("since") ?? undefined;
  const policy = { ...DEFAULT_OBSERVATION_POLICY, maxAgeHours: since ? 24 * 365 * 50 : 24 * 14 };
  const result = await runIngestion(new CftcSilverAdapter(), { since, policy });
  try {
    const persisted = await persistIngestionResult(result, { baseUrl, serviceRoleKey });
    return NextResponse.json({
      ...persisted, fetchedObservations: result.fetchedCount,
      rejectedObservations: result.rejectedCount, completedAt: result.completedAt, error: result.error,
    }, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json({
      error: "ingestion_persistence_failed",
      message: error instanceof Error ? error.message : "Unknown persistence error",
      ingestionStatus: result.status,
    }, { status: 502 });
  }
}
