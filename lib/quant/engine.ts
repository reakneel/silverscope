import type { FeatureSignal, IndicatorGroup } from "../data/contracts";
export const MODEL_VERSION = "silverscope-composite-0.1.0";
export const COMPONENT_WEIGHTS: Readonly<Record<IndicatorGroup, number>> = {
  inventory_liquidity: 0.30, macro: 0.25, supply_demand: 0.30, positioning: 0.15,
};
export interface ScorePolicy {
  minimumCoverage: number; minimumGroups: number; minimumConfidence: number; maxAgeHours: number;
  estimatedConfidenceMultiplier: number; manualConfidenceMultiplier: number;
}
export const DEFAULT_SCORE_POLICY: ScorePolicy = {
  minimumCoverage: 0.65, minimumGroups: 2, minimumConfidence: 0.35, maxAgeHours: 24 * 45,
  estimatedConfidenceMultiplier: 0.75, manualConfidenceMultiplier: 0.5,
};
export interface ComponentResult {
  group: IndicatorGroup; weight: number; score: number | null; coverage: number;
  confidence: number | null; inputCount: number;
}
export interface CompositeScore {
  modelVersion: string; status: "scored" | "insufficient_data"; score: number | null;
  regime: "bullish" | "neutral" | "bearish" | null; coverage: number; confidence: number | null;
  asOf: string; components: ComponentResult[]; acceptedInputKeys: string[];
  rejectedInputs: Array<{ key: string; reason: string }>;
  methodology: { minimumCoverage: number; minimumGroups: number; thresholds: { bearishMaximum: number; bullishMinimum: number } };
}
function timestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function normalizeZScore(value: number, mean: number, standardDeviation: number, direction: 1 | -1 = 1): number | null {
  if (![value, mean, standardDeviation].every(Number.isFinite) || standardDeviation <= 0) return null;
  const z = ((value - mean) / standardDeviation) * direction;
  return Math.max(0, Math.min(100, 50 + 15 * z));
}
export function calculateCompositeScore(inputs: FeatureSignal[], options: Partial<ScorePolicy> = {}, asOf: Date = new Date()): CompositeScore {
  const policy = { ...DEFAULT_SCORE_POLICY, ...options };
  const rejectedInputs: CompositeScore["rejectedInputs"] = [];
  const accepted: FeatureSignal[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const key = input.key || "(unknown)";
    const observed = timestamp(input.observedAt);
    let reason: string | null = null;
    if (!key.trim()) reason = "missing_key";
    else if (seen.has(key)) reason = "duplicate_key";
    else if (!(input.group in COMPONENT_WEIGHTS)) reason = "unknown_group";
    else if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) reason = "score_out_of_range";
    else if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) reason = "confidence_out_of_range";
    else if (input.confidence < policy.minimumConfidence) reason = "confidence_too_low";
    else if (observed === null) reason = "invalid_observed_at";
    else if (observed > asOf.getTime() + 5 * 60_000) reason = "observation_in_future";
    else if (asOf.getTime() - observed > policy.maxAgeHours * 3_600_000) reason = "stale";
    else if (input.status === "stale" || input.status === "unavailable") reason = "unusable_status";
    else if (input.status === "manual" && policy.manualConfidenceMultiplier <= 0) reason = "manual_disabled";
    if (reason) { rejectedInputs.push({ key, reason }); continue; }
    seen.add(key);
    accepted.push(input);
  }
  const groups = (Object.keys(COMPONENT_WEIGHTS) as IndicatorGroup[]).map((group) => {
    const rows = accepted.filter((item) => item.group === group);
    const adjusted = rows.map((item) => item.confidence * (item.status === "estimated" ? policy.estimatedConfidenceMultiplier : item.status === "manual" ? policy.manualConfidenceMultiplier : 1));
    const total = adjusted.reduce((sum, value) => sum + value, 0);
    const score = total > 0 ? rows.reduce((sum, item, index) => sum + item.score * adjusted[index], 0) / total : null;
    const confidence = rows.length ? adjusted.reduce((sum, value) => sum + value, 0) / rows.length : null;
    return { group, weight: COMPONENT_WEIGHTS[group], score, coverage: rows.length ? 1 : 0, confidence, inputCount: rows.length };
  });
  const available = groups.filter((item) => item.score !== null);
  const coverage = available.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = coverage ? available.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) / coverage : null;
  const confidence = coverage ? available.reduce((sum, item) => sum + (item.confidence ?? 0) * item.weight, 0) / coverage * coverage : null;
  const enough = coverage >= policy.minimumCoverage && available.length >= policy.minimumGroups && confidence !== null && confidence >= policy.minimumConfidence;
  const score = enough && weightedScore !== null ? Math.round(weightedScore * 100) / 100 : null;
  return {
    modelVersion: MODEL_VERSION, status: enough ? "scored" : "insufficient_data", score,
    regime: score === null ? null : score >= 60 ? "bullish" : score <= 40 ? "bearish" : "neutral",
    coverage: Math.round(coverage * 10_000) / 10_000,
    confidence: confidence === null ? null : Math.round(confidence * 10_000) / 10_000,
    asOf: asOf.toISOString(), components: groups, acceptedInputKeys: accepted.map((item) => item.key), rejectedInputs,
    methodology: { minimumCoverage: policy.minimumCoverage, minimumGroups: policy.minimumGroups, thresholds: { bearishMaximum: 40, bullishMinimum: 60 } },
  };
}
