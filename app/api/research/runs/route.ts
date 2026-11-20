import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { getUserEntitlements } from "@/lib/auth/authorization";
import { createExperimentManifest, createResearchSnapshot } from "@/lib/research/snapshot";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface ObservationRow {
  source_id: string; indicator_key: string; value: number | string; unit: string;
  observed_at: string; published_at: string; fetched_at: string; confidence: number | string;
  status: "verified"; source_url: string | null; source_record_id: string | null;
}
export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const entitlements = await getUserEntitlements(user.id);
    if (!entitlements.canAccessScenarioResearch) return NextResponse.json({ error: "plan_upgrade_required" }, { status: 403 });
    const response = await supabaseAdminRequest(`research_runs?owner_id=eq.${encodeURIComponent(user.id)}&select=id,experiment_id,dataset_id,decision_time,strategy_version,model_version,snapshot_sha256,created_at&order=created_at.desc&limit=50`);
    if (!response.ok) return NextResponse.json({ error: "research_runs_lookup_failed" }, { status: 503 });
    return NextResponse.json({ runs: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "research_runs_unavailable" }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const entitlements = await getUserEntitlements(user.id);
    if (!entitlements.canAccessScenarioResearch) return NextResponse.json({ error: "plan_upgrade_required" }, { status: 403 });
    const body = await request.json();
    const experiment = body?.experiment;
    const decisionTime = body?.decisionTime;
    if (!experiment || typeof experiment !== "object" || typeof decisionTime !== "string" || !Number.isFinite(Date.parse(decisionTime))) {
      return NextResponse.json({ error: "invalid_research_request" }, { status: 400 });
    }
    if (JSON.stringify(experiment.parameters ?? {}).length > 16000 || JSON.stringify(experiment.assumptions ?? {}).length > 16000) {
      return NextResponse.json({ error: "experiment_configuration_too_large" }, { status: 413 });
    }
    const decisionIso = new Date(decisionTime).toISOString();
    const cutoff = encodeURIComponent(decisionIso);
    const query = [
      "select=source_id,indicator_key,value,unit,observed_at,published_at,fetched_at,confidence,status,source_url,source_record_id",
      "status=eq.verified", "published_at=not.is.null",
      `observed_at=lte.${cutoff}`, `published_at=lte.${cutoff}`, `fetched_at=lte.${cutoff}`,
      "order=observed_at.asc", "limit=5001",
    ].join("&");
    const observationsResponse = await supabaseAdminRequest(`observations?${query}`);
    if (!observationsResponse.ok) return NextResponse.json({ error: "snapshot_data_lookup_failed" }, { status: 503 });
    const rows = await observationsResponse.json() as ObservationRow[];
    if (rows.length >= 5001) return NextResponse.json({ error: "snapshot_observation_limit_reached", limit: 5000 }, { status: 413 });
    if (!rows.length) return NextResponse.json({ error: "no_point_in_time_observations" }, { status: 422 });
    const observations = rows.map((row) => ({
      sourceId: row.source_id, indicatorKey: row.indicator_key, value: Number(row.value), unit: row.unit,
      observedAt: row.observed_at, publishedAt: row.published_at, fetchedAt: row.fetched_at,
      confidence: Number(row.confidence), status: row.status, sourceUrl: row.source_url, sourceRecordId: row.source_record_id,
    }));
    const manifest = createExperimentManifest({
      id: String(experiment.id ?? ""), hypothesis: String(experiment.hypothesis ?? ""),
      strategyVersion: String(experiment.strategyVersion ?? ""), modelVersion: String(experiment.modelVersion ?? ""),
      parameters: experiment.parameters ?? {}, assumptions: experiment.assumptions ?? {},
    });
    const snapshot = createResearchSnapshot({
      datasetId: `verified-observations-asof:${decisionIso}`, decisionTime: decisionIso,
      modelVersion: manifest.modelVersion, strategyVersion: manifest.strategyVersion,
      parameters: manifest.parameters, assumptions: manifest.assumptions, observations,
    });
    const experimentId = `${user.id}:${manifest.manifestSha256.slice(0, 32)}`;
    const savedExperiment = await supabaseAdminRequest("research_experiments?on_conflict=owner_id,manifest_sha256", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify([{
        id: experimentId, owner_id: user.id, hypothesis: manifest.hypothesis,
        strategy_version: manifest.strategyVersion, model_version: manifest.modelVersion,
        manifest_sha256: manifest.manifestSha256, manifest,
      }]),
    });
    if (!savedExperiment.ok) return NextResponse.json({ error: "experiment_persistence_failed" }, { status: 503 });
    const savedRun = await supabaseAdminRequest("research_runs?on_conflict=owner_id,snapshot_sha256", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify([{
        experiment_id: experimentId, owner_id: user.id, dataset_id: snapshot.payload.datasetId,
        decision_time: decisionIso, strategy_version: manifest.strategyVersion, model_version: manifest.modelVersion,
        snapshot_sha256: snapshot.sha256, snapshot: snapshot.payload,
        parameters: snapshot.payload.parameters, assumptions: snapshot.payload.assumptions,
      }]),
    });
    if (!savedRun.ok) return NextResponse.json({ error: "research_run_persistence_failed" }, { status: 503 });
    let runs = await savedRun.json();
    if (!runs.length) {
      const existing = await supabaseAdminRequest(`research_runs?owner_id=eq.${encodeURIComponent(user.id)}&snapshot_sha256=eq.${snapshot.sha256}&select=id,experiment_id,decision_time,snapshot_sha256,created_at&limit=1`);
      if (!existing.ok) return NextResponse.json({ error: "research_run_lookup_failed" }, { status: 503 });
      runs = await existing.json();
    }
    return NextResponse.json({
      run: runs[0], snapshotHash: snapshot.sha256,
      observationCount: snapshot.payload.observations.length, experimentHash: manifest.manifestSha256,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "research_run_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 422 });
  }
}
