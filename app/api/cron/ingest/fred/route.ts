import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_OBSERVATION_POLICY } from "@/lib/data/quality";
import { FredMacroAdapter } from "@/lib/ingestion/fred-adapter";
import { runIngestion } from "@/lib/ingestion/runner";
import { persistIngestionResult } from "@/lib/ingestion/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fredApiKey = process.env.FRED_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || !fredApiKey) {
    return NextResponse.json({
      error: "ingestion_not_configured",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FRED_API_KEY"],
    }, { status: 503 });
  }

  const since = new URL(request.url).searchParams.get("since") ?? undefined;
  const policy = {
    ...DEFAULT_OBSERVATION_POLICY,
    // Latest runs enforce a seven-day freshness window; historical backfills are retained for research.
    maxAgeHours: since ? 24 * 365 * 50 : 24 * 7,
  };
  const result = await runIngestion(new FredMacroAdapter(fredApiKey), { since, policy });
  try {
    const persisted = await persistIngestionResult(result, { baseUrl: supabaseUrl, serviceRoleKey });
    return NextResponse.json({
      ...persisted,
      fetchedObservations: result.fetchedCount,
      rejectedObservations: result.rejectedCount,
      completedAt: result.completedAt,
      error: result.error,
    }, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json({
      error: "ingestion_persistence_failed",
      message: error instanceof Error ? error.message : "Unknown persistence error",
      ingestionStatus: result.status,
    }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
