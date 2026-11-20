import type { Observation, ValidationIssue } from "../data/contracts";
import { validateObservation, type ObservationPolicy, DEFAULT_OBSERVATION_POLICY } from "../data/quality";
export interface SourceAdapter { sourceId: string; fetch(since?: string): Promise<Observation[]>; }
export interface IngestionResult {
  sourceId: string; status: "succeeded" | "partial" | "failed"; startedAt: string; completedAt: string;
  fetchedCount: number; acceptedCount: number; rejectedCount: number; observations: Observation[];
  rejected: Array<{ indicatorKey: string; issues: ValidationIssue[] }>; error?: string;
}
export async function runIngestion(adapter: SourceAdapter, options: { since?: string; policy?: ObservationPolicy; now?: Date } = {}): Promise<IngestionResult> {
  const startedAt = (options.now ?? new Date()).toISOString();
  try {
    const fetched = await adapter.fetch(options.since);
    const accepted: Observation[] = [], rejected: IngestionResult["rejected"] = [];
    for (const observation of fetched) {
      const result = validateObservation(observation, options.policy ?? DEFAULT_OBSERVATION_POLICY, options.now ?? new Date());
      if (result.valid && result.value) accepted.push(result.value);
      else rejected.push({ indicatorKey: observation.indicatorKey, issues: result.issues });
    }
    return {
      sourceId: adapter.sourceId, status: rejected.length === 0 ? "succeeded" : accepted.length ? "partial" : "failed",
      startedAt, completedAt: new Date().toISOString(), fetchedCount: fetched.length, acceptedCount: accepted.length,
      rejectedCount: rejected.length, observations: accepted, rejected,
    };
  } catch (error) {
    return {
      sourceId: adapter.sourceId, status: "failed", startedAt, completedAt: new Date().toISOString(),
      fetchedCount: 0, acceptedCount: 0, rejectedCount: 0, observations: [], rejected: [],
      error: error instanceof Error ? error.message : "Unknown ingestion error",
    };
  }
}
