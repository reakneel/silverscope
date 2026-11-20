import type { FeatureSignal, Observation } from "../data/contracts";
import type { FeatureCalibration } from "../quant/features";
import { buildFeatureSignals } from "../quant/features";

/**
 * Strict point-in-time feature construction for historical research.
 * Requires an explicit publication/availability timestamp; observedAt alone is
 * not sufficient to prove that a value was known to the strategy at decision time.
 */
export function buildPointInTimeFeatureSignals(
  observations: Observation[],
  calibrations: FeatureCalibration[],
  decisionAt: Date,
): { features: FeatureSignal[]; skipped: Array<{ indicatorKey: string; reason: string }> } {
  if (!Number.isFinite(decisionAt.getTime())) throw new Error("decisionAt must be a valid date.");
  const eligible: Observation[] = [];
  const skipped: Array<{ indicatorKey: string; reason: string }> = [];
  const decisionTime = decisionAt.getTime();
  for (const observation of observations) {
    const observedTime = Date.parse(observation.observedAt);
    const publishedTime = observation.publishedAt ? Date.parse(observation.publishedAt) : Number.NaN;
    if (!Number.isFinite(observedTime) || observedTime > decisionTime) {
      skipped.push({ indicatorKey: observation.indicatorKey, reason: "not_observed_by_decision_time" });
    } else if (!Number.isFinite(publishedTime)) {
      skipped.push({ indicatorKey: observation.indicatorKey, reason: "publication_time_unknown" });
    } else if (publishedTime > decisionTime) {
      skipped.push({ indicatorKey: observation.indicatorKey, reason: "not_published_by_decision_time" });
    } else if (observation.status !== "verified") {
      skipped.push({ indicatorKey: observation.indicatorKey, reason: "not_verified" });
    } else {
      eligible.push(observation);
    }
  }
  const built = buildFeatureSignals(eligible, calibrations);
  return { features: built.features, skipped: [...skipped, ...built.skipped] };
}
