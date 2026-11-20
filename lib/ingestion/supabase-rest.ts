import type { IngestionResult } from "./runner";
interface SupabaseRow { id?: string; }
interface SupabaseRestOptions { baseUrl: string; serviceRoleKey: string; fetchImpl?: typeof fetch; }
export interface PersistedIngestion {
  runId: string; insertedObservations: number; acceptedObservations: number; status: IngestionResult["status"];
}
export async function persistIngestionResult(result: IngestionResult, options: SupabaseRestOptions): Promise<PersistedIngestion> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const headers = { apikey: options.serviceRoleKey, Authorization: `Bearer ${options.serviceRoleKey}`, "Content-Type": "application/json" };
  const request = async (path: string, method: string, body?: unknown, prefer?: string) => {
    const response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, {
      method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Supabase REST ${method} ${path} failed (HTTP ${response.status}): ${detail}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  const created = await request("ingestion_runs", "POST", [{
    source_id: result.sourceId, status: "running", started_at: result.startedAt, metadata: { adapter: "fred-macro-v1" },
  }], "return=representation") as SupabaseRow[] | null;
  const runId = created?.[0]?.id;
  if (!runId) throw new Error("Supabase did not return an ingestion run ID.");

  try {
    let insertedObservations = 0;
    if (result.observations.length) {
      const rows = result.observations.map((item) => ({
        source_id: item.sourceId, indicator_key: item.indicatorKey, value: item.value, unit: item.unit,
        observed_at: item.observedAt, published_at: item.publishedAt, fetched_at: item.fetchedAt,
        confidence: item.confidence, status: item.status, source_url: item.sourceUrl ?? null,
        source_record_id: item.sourceRecordId ?? null,
        dedupe_key: `${item.sourceId}:${item.indicatorKey}:${item.observedAt}`,
        raw_payload: { source_record_id: item.sourceRecordId ?? null },
      }));
      const inserted = await request("observations?on_conflict=dedupe_key", "POST", rows,
        "resolution=ignore-duplicates,return=representation") as unknown[] | null;
      insertedObservations = inserted?.length ?? 0;
    }

    await request(`ingestion_runs?id=eq.${encodeURIComponent(runId)}`, "PATCH", [{
      status: result.status, completed_at: result.completedAt, fetched_count: result.fetchedCount,
      accepted_count: result.acceptedCount, rejected_count: result.rejectedCount, error_summary: result.error ?? null,
      metadata: { adapter: "fred-macro-v1", inserted_observations: insertedObservations, rejected: result.rejected },
    }], "return=minimal");

    if (result.status !== "failed") {
      await request("data_sources?id=eq.fred", "PATCH", [{
        enabled: true, last_success_at: result.completedAt,
      }], "return=minimal");
    }
    return { runId, insertedObservations, acceptedObservations: result.acceptedCount, status: result.status };
  } catch (error) {
    await request(`ingestion_runs?id=eq.${encodeURIComponent(runId)}`, "PATCH", [{
      status: "failed", completed_at: new Date().toISOString(),
      error_summary: error instanceof Error ? error.message.slice(0, 500) : "Persistence failed",
    }], "return=minimal");
    throw error;
  }
}
