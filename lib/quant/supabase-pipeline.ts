import type { Observation } from "../data/contracts";
import type { CompositeScore } from "./engine";
import type { SignalSnapshot } from "./signals";
interface PipelineOptions { baseUrl: string; serviceRoleKey: string; fetchImpl?: typeof fetch; }
interface SupabaseRow { id?: string; }
function createRest(options: PipelineOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const headers = { apikey: options.serviceRoleKey, Authorization: `Bearer ${options.serviceRoleKey}`, "Content-Type": "application/json" };
  return async (path: string, method = "GET", body?: unknown, prefer?: string) => {
    const response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, {
      method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase REST ${method} ${path} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
    if (response.status === 204) return null;
    const payload = await response.text();
    return payload ? JSON.parse(payload) : null;
  };
}
export async function fetchRecentObservations(options: PipelineOptions, limit = 1000): Promise<Observation[]> {
  const rest = createRest(options);
  const query = new URLSearchParams({
    select: "source_id,indicator_key,value,unit,observed_at,published_at,fetched_at,confidence,status,source_url,source_record_id",
    order: "observed_at.desc", limit: String(Math.max(1, Math.min(limit, 5000))),
  });
  const rows = await rest(`observations?${query.toString()}`) as Array<Record<string, unknown>> | null;
  return (rows ?? []).map((row) => ({
    sourceId: String(row.source_id), indicatorKey: String(row.indicator_key),
    value: Number(row.value), unit: String(row.unit), observedAt: String(row.observed_at),
    publishedAt: row.published_at ? String(row.published_at) : null,
    fetchedAt: String(row.fetched_at), confidence: Number(row.confidence),
    status: row.status as Observation["status"],
    sourceUrl: row.source_url ? String(row.source_url) : null,
    sourceRecordId: row.source_record_id ? String(row.source_record_id) : null,
  }));
}
export async function persistQuantSnapshot(
  options: PipelineOptions, score: CompositeScore, signal: SignalSnapshot, snapshotKey: string,
): Promise<{ scoreId: string; signalRows: number; snapshotKey: string }> {
  const rest = createRest(options);
  const scoreRows = await rest("scores?on_conflict=model_version_id,snapshot_key", "POST", {
    model_version_id: score.modelVersion, snapshot_key: snapshotKey,
    score: score.score, regime: score.regime, coverage: score.coverage, confidence: score.confidence,
    as_of: score.asOf, input_snapshot: { snapshotKey, acceptedInputKeys: score.acceptedInputKeys, rejectedInputs: score.rejectedInputs },
    component_scores: score.components,
  }, "resolution=ignore-duplicates,return=representation") as SupabaseRow[] | null;
  let scoreId = scoreRows?.[0]?.id;
  if (!scoreId) {
    const query = new URLSearchParams({ select: "id", model_version_id: `eq.${score.modelVersion}`, snapshot_key: `eq.${snapshotKey}`, limit: "1" });
    const existing = await rest(`scores?${query.toString()}`) as SupabaseRow[] | null;
    scoreId = existing?.[0]?.id;
  }
  if (!scoreId) throw new Error("Could not resolve persisted score snapshot ID.");
  const signalRows = await rest("signals?on_conflict=model_version_id,signal_key,snapshot_key", "POST", [{
    score_id: scoreId, model_version_id: score.modelVersion, signal_key: signal.signalKey,
    snapshot_key: snapshotKey, horizon: signal.horizon, direction: signal.direction,
    confidence: signal.confidence, evidence: signal.evidence,
    invalidation_conditions: signal.invalidationConditions, generated_at: signal.generatedAt,
  }], "resolution=ignore-duplicates,return=representation") as unknown[] | null;
  return { scoreId, signalRows: signalRows?.length ?? 0, snapshotKey };
}
