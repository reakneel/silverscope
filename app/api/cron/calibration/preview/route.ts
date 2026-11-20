import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deriveCalibrationPreviews } from "@/lib/quant/calibration";
import { fetchObservationsForIndicator } from "@/lib/quant/supabase-pipeline";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const definitions = [
  { indicatorKey: "us_10y_real_yield", group: "macro", direction: -1 },
  { indicatorKey: "us_dollar_index", group: "macro", direction: -1 },
  { indicatorKey: "us_10y_nominal_yield", group: "macro", direction: -1 },
  { indicatorKey: "cftc_managed_money_net", group: "positioning", direction: 1 },
] as const;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  try {
    const observations = (await Promise.all(definitions.map((definition) =>
      fetchObservationsForIndicator({ baseUrl, serviceRoleKey }, definition.indicatorKey, 5000)
    ))).flat();
    const previews = deriveCalibrationPreviews(observations, [...definitions], 52);
    const ready = previews.every((item) => item.ready);
    const config = ready ? previews.map(({ indicatorKey, group, direction, mean, standardDeviation }) => ({
      indicatorKey, group, direction, mean, standardDeviation,
    })) : null;
    return NextResponse.json({
      status: ready ? "preview_ready" : "insufficient_history",
      minimumSamples: 52, previews, suggestedEnvironmentValue: config ? JSON.stringify(config) : null,
      warning: "Preview only. Review the sample window, market regime coverage and point-in-time leakage before activating. Do not treat these full-history statistics as a validated trading model.",
    });
  } catch (error) {
    return NextResponse.json({ error: "calibration_preview_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
