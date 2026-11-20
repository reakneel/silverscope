import type { Observation, IndicatorGroup } from "../data/contracts";
export interface CalibrationDefinition { indicatorKey: string; group: IndicatorGroup; direction: 1 | -1; }
export interface CalibrationPreview {
  indicatorKey: string; group: IndicatorGroup; direction: 1 | -1;
  sampleCount: number; mean: number | null; standardDeviation: number | null;
  ready: boolean; reason?: string;
}
export function deriveCalibrationPreviews(
  observations: Observation[], definitions: CalibrationDefinition[], minimumSamples = 52,
): CalibrationPreview[] {
  return definitions.map((definition) => {
    const values = observations
      .filter((row) => row.indicatorKey === definition.indicatorKey && row.status === "verified" && Number.isFinite(row.value))
      .map((row) => row.value);
    if (values.length < minimumSamples) return {
      ...definition, sampleCount: values.length, mean: null, standardDeviation: null,
      ready: false, reason: "insufficient_verified_history",
    };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const standardDeviation = Math.sqrt(variance);
    if (!Number.isFinite(standardDeviation) || standardDeviation <= 0) return {
      ...definition, sampleCount: values.length, mean, standardDeviation: null,
      ready: false, reason: "zero_or_invalid_variance",
    };
    return { ...definition, sampleCount: values.length, mean, standardDeviation, ready: true };
  });
}
