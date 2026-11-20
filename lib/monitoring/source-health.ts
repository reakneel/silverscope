export type IngestionRunStatus = "succeeded" | "partial" | "failed";
export type SourceHealthStatus = "disabled" | "blocked" | "never_succeeded" | "healthy" | "delayed" | "stale" | "failed" | "degraded";
export interface SourceHealthInput {
  sourceId: string;
  enabled: boolean;
  licenseStatus: "unverified" | "public_api" | "licensed" | "restricted";
  /** Must be supplied from an explicit source-specific cadence policy; never parsed from prose. */
  expectedIntervalMs: number | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastRunStatus: IngestionRunStatus | null;
  lastError?: string | null;
  now: string;
  staleAfterIntervals?: number;
  delayedAfterIntervals?: number;
}
export interface SourceHealthAlert {
  sourceId: string;
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
}
export interface SourceHealthResult {
  sourceId: string;
  status: SourceHealthStatus;
  ageMs: number | null;
  expectedIntervalMs: number | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastRunStatus: IngestionRunStatus | null;
  alerts: SourceHealthAlert[];
}
export interface SourceHealthSummary {
  checkedAt: string;
  total: number;
  healthy: number;
  delayed: number;
  stale: number;
  failed: number;
  blocked: number;
  disabled: number;
  neverSucceeded: number;
  degraded: number;
  alerts: SourceHealthAlert[];
}
function timestamp(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid timestamp.`);
  return parsed;
}
/** Evaluates source health from explicit cadence and persisted ingestion metadata. */
export function evaluateSourceHealth(input: SourceHealthInput): SourceHealthResult {
  if (!input.sourceId.trim()) throw new Error("sourceId is required.");
  const now = timestamp(input.now, "now");
  if (input.expectedIntervalMs !== null && (!Number.isFinite(input.expectedIntervalMs) || input.expectedIntervalMs <= 0)) throw new Error("expectedIntervalMs must be positive or null.");
  const staleAfter = input.staleAfterIntervals ?? 2;
  const delayedAfter = input.delayedAfterIntervals ?? 1.25;
  if (!Number.isFinite(delayedAfter) || !Number.isFinite(staleAfter) || delayedAfter <= 0 || staleAfter <= delayedAfter) throw new Error("Health thresholds must satisfy 0 < delayedAfterIntervals < staleAfterIntervals.");
  const lastSuccess = input.lastSuccessAt === null ? null : timestamp(input.lastSuccessAt, "lastSuccessAt");
  const lastAttempt = input.lastAttemptAt === null ? null : timestamp(input.lastAttemptAt, "lastAttemptAt");
  if (lastSuccess !== null && lastSuccess > now) throw new Error("lastSuccessAt cannot be in the future.");
  if (lastAttempt !== null && lastAttempt > now) throw new Error("lastAttemptAt cannot be in the future.");
  if (lastSuccess !== null && lastAttempt !== null && lastAttempt < lastSuccess) throw new Error("lastAttemptAt cannot precede lastSuccessAt.");
  const ageMs = lastSuccess === null ? null : now - lastSuccess;
  const alerts: SourceHealthAlert[] = [];
  const alert = (severity: SourceHealthAlert["severity"], code: string, message: string) => alerts.push({ sourceId: input.sourceId, severity, code, message });
  let status: SourceHealthStatus;
  if (!input.enabled) {
    status = "disabled";
    alert("info", "source_disabled", "Source ingestion is disabled.");
  } else if (input.licenseStatus === "unverified" || input.licenseStatus === "restricted") {
    status = "blocked";
    alert("critical", "source_license_blocked", "Source is not cleared for the configured ingestion or redistribution use.");
  } else if (input.expectedIntervalMs === null) {
    status = "degraded";
    alert("warning", "cadence_unconfigured", "No explicit source cadence interval is configured.");
  } else if (lastSuccess === null) {
    status = input.lastRunStatus === "failed" ? "failed" : "never_succeeded";
    alert("critical", input.lastRunStatus === "failed" ? "initial_ingestion_failed" : "never_succeeded", input.lastError ?? "No successful ingestion has been recorded.");
  } else if (ageMs! > input.expectedIntervalMs * staleAfter) {
    status = "stale";
    alert("critical", "source_stale", "Latest successful observation is older than the stale threshold.");
  } else if (input.lastRunStatus === "failed" || input.lastRunStatus === "partial") {
    status = "degraded";
    alert("warning", input.lastRunStatus === "failed" ? "latest_ingestion_failed" : "partial_ingestion", input.lastError ?? "Latest ingestion did not complete successfully.");
  } else if (ageMs! > input.expectedIntervalMs * delayedAfter) {
    status = "delayed";
    alert("warning", "source_delayed", "Latest successful ingestion is older than the expected cadence threshold.");
  } else {
    status = "healthy";
  }
  return {
    sourceId: input.sourceId, status, ageMs, expectedIntervalMs: input.expectedIntervalMs,
    lastSuccessAt: input.lastSuccessAt, lastAttemptAt: input.lastAttemptAt,
    lastRunStatus: input.lastRunStatus, alerts,
  };
}
export function summarizeSourceHealth(results: SourceHealthResult[], checkedAt: string): SourceHealthSummary {
  timestamp(checkedAt, "checkedAt");
  const counts = {
    healthy: 0, delayed: 0, stale: 0, failed: 0, blocked: 0,
    disabled: 0, neverSucceeded: 0, degraded: 0,
  };
  for (const result of results) {
    if (result.status === "never_succeeded") counts.neverSucceeded++;
    else counts[result.status]++;
  }
  return {
    checkedAt, total: results.length, ...counts,
    alerts: results.flatMap((result) => result.alerts),
  };
}
