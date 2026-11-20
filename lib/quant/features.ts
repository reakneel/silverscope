import type { FeatureSignal, IndicatorGroup, Observation } from "../data/contracts";
import { normalizeZScore } from "./engine";

export interface FeatureCalibration {
  indicatorKey: string;
  group: IndicatorGroup;
  mean: number;
  standardDeviation: number;
  direction: 1 | -1;
}
export function parseFeatureCalibrations(raw: string | undefined): FeatureCalibration[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("SILVER_FEATURE_CALIBRATION_JSON must be valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("SILVER_FEATURE_CALIBRATION_JSON must be an array.");
  const seen = new Set<string>();
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Calibration at index ${index} must be an object.`);
    const row = item as Record<string, unknown>;
    const validGroups: IndicatorGroup[] = ["inventory_liquidity", "macro", "supply_demand", "positioning"];
    if (typeof row.indicatorKey !== "string" || !row.indicatorKey.trim()) throw new Error(`Calibration ${index} has no indicatorKey.`);
    if (seen.has(row.indicatorKey)) throw new Error(`Duplicate calibration for ${row.indicatorKey}.`);
    if (typeof row.group !== "string" || !validGroups.includes(row.group as IndicatorGroup)) throw new Error(`Calibration ${index} has an invalid group.`);
    if (typeof row.mean !== "number" || !Number.isFinite(row.mean)) throw new Error(`Calibration ${index} has an invalid mean.`);
    if (typeof row.standardDeviation !== "number" || !Number.isFinite(row.standardDeviation) || row.standardDeviation <= 0) throw new Error(`Calibration ${index} has an invalid standardDeviation.`);
    if (row.direction !== 1 && row.direction !== -1) throw new Error(`Calibration ${index} direction must be 1 or -1.`);
    seen.add(row.indicatorKey);
    return { indicatorKey: row.indicatorKey, group: row.group as IndicatorGroup, mean: row.mean, standardDeviation: row.standardDeviation, direction: row.direction };
  });
}
export function buildFeatureSignals(
  observations: Observation[], calibrations: FeatureCalibration[],
): { features: FeatureSignal[]; skipped: Array<{ indicatorKey: string; reason: string }> } {
  const latest = new Map<string, Observation>();
  for (const observation of observations) {
    const existing = latest.get(observation.indicatorKey);
    if (!existing || Date.parse(observation.observedAt) > Date.parse(existing.observedAt)) latest.set(observation.indicatorKey, observation);
  }
  const features: FeatureSignal[] = [];
  const skipped: Array<{ indicatorKey: string; reason: string }> = [];
  for (const calibration of calibrations) {
    // COMEX total is mechanically registered + eligible; keep it displayable as an observation,
    // but never count it as a third independent inventory input in composite coverage.
    if (calibration.indicatorKey === "comex_total_stocks") {
      skipped.push({ indicatorKey: calibration.indicatorKey, reason: "derived_not_independent" });
      continue;
    }
    const observation = latest.get(calibration.indicatorKey);
    if (!observation) { skipped.push({ indicatorKey: calibration.indicatorKey, reason: "no_observation" }); continue; }
    const score = normalizeZScore(observation.value, calibration.mean, calibration.standardDeviation, calibration.direction);
    if (score === null) { skipped.push({ indicatorKey: calibration.indicatorKey, reason: "invalid_calibration_or_value" }); continue; }
    features.push({
      key: calibration.indicatorKey, group: calibration.group, score,
      confidence: observation.confidence, observedAt: observation.observedAt,
      status: observation.status, sourceId: observation.sourceId,
      explanation: `Normalized from ${observation.value} ${observation.unit} against configured calibration.`,
    });
  }
  return { features, skipped };
}
