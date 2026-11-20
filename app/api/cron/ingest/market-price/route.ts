import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_OBSERVATION_POLICY } from "@/lib/data/quality";
import { LicensedSilverPriceCsvAdapter } from "@/lib/ingestion/licensed-price-csv";
import { runIngestion } from "@/lib/ingestion/runner";
import { persistIngestionResult } from "@/lib/ingestion/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.MARKET_DATA_LICENSE_STATUS !== "licensed") {
    return NextResponse.json({ error: "licensed_provider_not_configured" }, { status: 503 });
  }
  const providerName = process.env.MARKET_DATA_PROVIDER_NAME?.trim();
  const sourceUrl = process.env.MARKET_DATA_SOURCE_URL?.trim();
  if (!providerName || !sourceUrl || !sourceUrl.startsWith("https://")) {
    return NextResponse.json({ error: "licensed_provider_metadata_missing" }, { status: 503 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("text/plain")) {
    return NextResponse.json({ error: "csv_content_type_required" }, { status: 415 });
  }
  const csv = await request.text();
  if (!csv.trim() || Buffer.byteLength(csv, "utf8") > 2_000_000) {
    return NextResponse.json({ error: "invalid_csv_size", maximumBytes: 2_000_000 }, { status: 413 });
  }
  const result = await runIngestion(new LicensedSilverPriceCsvAdapter(csv, { providerName, sourceUrl }), {
    policy: { ...DEFAULT_OBSERVATION_POLICY, maxAgeHours: 24 * 365 * 50 },
  });
  if (result.status === "failed") {
    return NextResponse.json({ error: "silver_price_import_failed", message: result.error }, { status: 422 });
  }
  try {
    const persisted = await persistIngestionResult(result, { baseUrl, serviceRoleKey });
    const metadataResponse = await fetch(`${baseUrl.replace(/\\/$/, "")}/rest/v1/data_sources?id=eq.licensed-market-data`, {
      method: "PATCH", cache: "no-store",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ name: providerName, source_url: sourceUrl, license_status: "licensed", enabled: true }),
    });
    if (!metadataResponse.ok) throw new Error(`Could not persist licensed provider metadata (HTTP ${metadataResponse.status}).`);
    return NextResponse.json({
      ...persisted, fetchedObservations: result.fetchedCount,
      rejectedObservations: result.rejectedCount, completedAt: result.completedAt,
      provider: providerName, indicatorKey: "silver_spot_usd_oz",
    });
  } catch (error) {
    return NextResponse.json({
      error: "ingestion_persistence_failed",
      message: error instanceof Error ? error.message : "Unknown persistence error",
      ingestionStatus: result.status,
    }, { status: 502 });
  }
}
