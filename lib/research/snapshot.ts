import { createHash } from "node:crypto";
import type { Observation } from "../data/contracts";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export interface ResearchSnapshotInput {
  datasetId: string;
  decisionTime: string;
  modelVersion: string;
  strategyVersion: string;
  parameters: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  observations: Observation[];
}
export interface ResearchSnapshotPayload {
  schemaVersion: "silverscope-research-snapshot/1";
  datasetId: string;
  decisionTime: string;
  modelVersion: string;
  strategyVersion: string;
  parameters: JsonValue;
  assumptions: JsonValue;
  observations: Observation[];
}
export interface ResearchSnapshot {
  payload: ResearchSnapshotPayload;
  sha256: string;
}
export interface ExperimentDefinition {
  id: string;
  hypothesis: string;
  strategyVersion: string;
  modelVersion: string;
  parameters: Record<string, unknown>;
  assumptions: Record<string, unknown>;
}
export interface ExperimentManifest extends Omit<ExperimentDefinition, "parameters" | "assumptions"> {
  schemaVersion: "silverscope-experiment/1";
  parameters: JsonValue;
  assumptions: JsonValue;
  manifestSha256: string;
}
function normalizeJson(value: unknown, path = "value"): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must not contain non-finite numbers.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalizeJson(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    const result = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) throw new Error(`${path}.${key} must not be undefined.`);
      result[key] = normalizeJson(item, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`${path} must contain only JSON-compatible values.`);
}
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}
export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
function validTime(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid timestamp.`);
  return parsed;
}
/**
 * Creates an immutable, deterministic point-in-time research input snapshot.
 * Unknown publication times, unverified observations and data fetched after decisionTime
 * are rejected rather than silently included or assigned inferred timestamps.
 */
export function createResearchSnapshot(input: ResearchSnapshotInput): ResearchSnapshot {
  for (const [name, value] of Object.entries({
    datasetId: input.datasetId, modelVersion: input.modelVersion, strategyVersion: input.strategyVersion,
  })) if (!value.trim()) throw new Error(`${name} is required.`);
  const decision = validTime(input.decisionTime, "decisionTime");
  const seen = new Set<string>();
  const observations = input.observations.map((observation) => {
    const observed = validTime(observation.observedAt, "observedAt");
    const published = observation.publishedAt === null ? Number.NaN : validTime(observation.publishedAt, "publishedAt");
    const fetched = validTime(observation.fetchedAt, "fetchedAt");
    if (observation.status !== "verified") throw new Error("Research snapshots only accept verified observations.");
    if (!Number.isFinite(published)) throw new Error("Research snapshots require a known publishedAt timestamp.");
    if (observed > decision || published > decision || fetched > decision || fetched < published) throw new Error("Observation was not fully available at decisionTime.");
    if (!Number.isFinite(observation.value) || !Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) throw new Error("Observation value or confidence is invalid.");
    if (!observation.sourceId || !observation.indicatorKey || !observation.unit) throw new Error("Observation provenance fields are required.");
    const identity = [observation.sourceId, observation.indicatorKey, observation.observedAt, observation.sourceRecordId ?? ""].join("|");
    if (seen.has(identity)) throw new Error("Duplicate observation identity in research snapshot.");
    seen.add(identity);
    return { ...observation };
  }).sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId) ||
    a.indicatorKey.localeCompare(b.indicatorKey) ||
    a.observedAt.localeCompare(b.observedAt) ||
    (a.sourceRecordId ?? "").localeCompare(b.sourceRecordId ?? "")
  );
  const payload: ResearchSnapshotPayload = {
    schemaVersion: "silverscope-research-snapshot/1",
    datasetId: input.datasetId,
    decisionTime: input.decisionTime,
    modelVersion: input.modelVersion,
    strategyVersion: input.strategyVersion,
    parameters: normalizeJson(input.parameters, "parameters"),
    assumptions: normalizeJson(input.assumptions, "assumptions"),
    observations,
  };
  return { payload, sha256: sha256Canonical(payload) };
}
export function createExperimentManifest(definition: ExperimentDefinition): ExperimentManifest {
  for (const [name, value] of Object.entries({
    id: definition.id, hypothesis: definition.hypothesis,
    strategyVersion: definition.strategyVersion, modelVersion: definition.modelVersion,
  })) if (!value.trim()) throw new Error(`${name} is required.`);
  const normalized = {
    schemaVersion: "silverscope-experiment/1" as const,
    id: definition.id,
    hypothesis: definition.hypothesis,
    strategyVersion: definition.strategyVersion,
    modelVersion: definition.modelVersion,
    parameters: normalizeJson(definition.parameters, "parameters"),
    assumptions: normalizeJson(definition.assumptions, "assumptions"),
  };
  return { ...normalized, manifestSha256: sha256Canonical(normalized) };
}
