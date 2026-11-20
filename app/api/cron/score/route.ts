import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_SCORE_POLICY, calculateCompositeScore } from "@/lib/quant/engine";
import { buildFeatureSignals, parseFeatureCalibrations } from "@/lib/quant/features";
import { buildSignalSnapshot } from "@/lib/quant/signals";
import { fetchRecentObservations, persistQuantSnapshot } from "@/lib/quant/supabase-pipeline";
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
  let calibrations;
  try { calibrations = parseFeatureCalibrations(process.env.SILVER_FEATURE_CALIBRATION_JSON); }
  catch (error) {
    return NextResponse.json({ error: "invalid_calibration", message: error instanceof Error ? error.message : "Invalid calibration" }, { status: 503 });
  }
  if (!calibrations.length) return NextResponse.json({
    status: "calibration_required", message: "Configure empirical feature calibrations before generating a score.",
    required: ["SILVER_FEATURE_CALIBRATION_JSON"],
  }, { status: 503 });
  try {
    const observations = await fetchRecentObservations({ baseUrl, serviceRoleKey });
    const { features, skipped } = buildFeatureSignals(observations, calibrations);
    const score = calculateCompositeScore(features, DEFAULT_SCORE_POLICY);
    if (score.status !== "scored") return NextResponse.json({
      status: "insufficient_data", modelVersion: score.modelVersion, coverage: score.coverage,
      confidence: score.confidence, components: score.components, rejectedInputs: score.rejectedInputs, skipped,
      message: "No score or signal was published because minimum coverage, group count or confidence was not met.",
    }, { status: 200 });
    const signal = buildSignalSnapshot(score);
    if (!signal) return NextResponse.json({ error: "signal_generation_failed" }, { status: 500 });
    const canonicalInputs = features.slice().sort((a, b) => a.key.localeCompare(b.key)).map((feature) => ({
      key: feature.key, group: feature.group, score: feature.score, confidence: feature.confidence,
      observedAt: feature.observedAt, status: feature.status, sourceId: feature.sourceId,
    }));
    const snapshotKey = createHash("sha256").update(JSON.stringify({
      modelVersion: score.modelVersion, calibrations: calibrations.slice().sort((a, b) => a.indicatorKey.localeCompare(b.indicatorKey)), inputs: canonicalInputs,
    })).digest("hex");
    const persisted = await persistQuantSnapshot({ baseUrl, serviceRoleKey }, score, signal, snapshotKey);
    return NextResponse.json({ status: "scored", ...persisted, score, signal, skipped });
  } catch (error) {
    return NextResponse.json({ error: "quant_pipeline_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
