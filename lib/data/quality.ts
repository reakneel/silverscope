import type { Observation, ValidationIssue, ValidationResult } from "./contracts";
export interface ObservationPolicy {
  maxAgeHours: number; allowEstimated: boolean; allowManual: boolean;
  minimumConfidence: number; allowFutureSkewMinutes: number;
}
export const DEFAULT_OBSERVATION_POLICY: ObservationPolicy = {
  maxAgeHours: 24 * 45, allowEstimated: true, allowManual: false,
  minimumConfidence: 0.35, allowFutureSkewMinutes: 5,
};
function parseTimestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function validateObservation(input: Observation, policy: ObservationPolicy = DEFAULT_OBSERVATION_POLICY, now: Date = new Date()): ValidationResult<Observation> {
  const issues: ValidationIssue[] = [];
  const fetched = parseTimestamp(input.fetchedAt), observed = parseTimestamp(input.observedAt), published = parseTimestamp(input.publishedAt);
  const nowMs = now.getTime();
  if (!input.sourceId.trim()) issues.push({ code: "SOURCE_REQUIRED", message: "sourceId is required.", field: "sourceId" });
  if (!input.indicatorKey.trim()) issues.push({ code: "INDICATOR_REQUIRED", message: "indicatorKey is required.", field: "indicatorKey" });
  if (!input.unit.trim()) issues.push({ code: "UNIT_REQUIRED", message: "unit is required.", field: "unit" });
  if (!Number.isFinite(input.value)) issues.push({ code: "VALUE_NOT_FINITE", message: "value must be finite.", field: "value" });
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) issues.push({ code: "CONFIDENCE_OUT_OF_RANGE", message: "confidence must be between 0 and 1.", field: "confidence" });
  else if (input.confidence < policy.minimumConfidence) issues.push({ code: "CONFIDENCE_TOO_LOW", message: "confidence is below the configured minimum.", field: "confidence" });
  if (fetched === null) issues.push({ code: "FETCHED_AT_INVALID", message: "fetchedAt must be a valid ISO timestamp.", field: "fetchedAt" });
  if (observed === null) issues.push({ code: "OBSERVED_AT_INVALID", message: "observedAt must be a valid ISO timestamp.", field: "observedAt" });
  if (input.publishedAt !== null && published === null) issues.push({ code: "PUBLISHED_AT_INVALID", message: "publishedAt must be null or a valid ISO timestamp.", field: "publishedAt" });
  if (fetched !== null && fetched > nowMs + policy.allowFutureSkewMinutes * 60_000) issues.push({ code: "FETCHED_IN_FUTURE", message: "fetchedAt is too far in the future.", field: "fetchedAt" });
  if (observed !== null && fetched !== null && observed > fetched + policy.allowFutureSkewMinutes * 60_000) issues.push({ code: "OBSERVATION_AFTER_FETCH", message: "observedAt cannot materially postdate fetchedAt.", field: "observedAt" });
  if (published !== null && fetched !== null && published > fetched + policy.allowFutureSkewMinutes * 60_000) issues.push({ code: "PUBLICATION_AFTER_FETCH", message: "publishedAt cannot materially postdate fetchedAt.", field: "publishedAt" });
  if (observed !== null && nowMs - observed > policy.maxAgeHours * 3_600_000) issues.push({ code: "OBSERVATION_STALE", message: "observation is older than the freshness window.", field: "observedAt" });
  if (input.status === "stale" || input.status === "unavailable") issues.push({ code: "STATUS_NOT_INGESTIBLE", message: "stale and unavailable observations cannot enter scoring.", field: "status" });
  if (input.status === "estimated" && !policy.allowEstimated) issues.push({ code: "ESTIMATES_DISABLED", message: "estimated observations are disabled.", field: "status" });
  if (input.status === "manual" && !policy.allowManual) issues.push({ code: "MANUAL_DISABLED", message: "manual observations are disabled.", field: "status" });
  return issues.length === 0 ? { valid: true, value: input, issues } : { valid: false, issues };
}
export function observationAgeHours(observedAt: string, now: Date = new Date()): number | null {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 3_600_000);
}
