import type { CompositeScore } from "./engine";
export interface SignalSnapshot {
  signalKey: string; horizon: "swing"; direction: "bullish" | "neutral" | "bearish";
  confidence: number; evidence: Record<string, unknown>; invalidationConditions: string[];
  generatedAt: string;
}
export function buildSignalSnapshot(score: CompositeScore): SignalSnapshot | null {
  if (score.status !== "scored" || score.score === null || score.confidence === null) return null;
  const direction = score.regime;
  if (!direction) return null;
  return {
    signalKey: "silver-composite-regime",
    horizon: "swing",
    direction,
    confidence: score.confidence,
    generatedAt: score.asOf,
    evidence: {
      modelVersion: score.modelVersion, compositeScore: score.score,
      coverage: score.coverage, components: score.components,
      acceptedInputKeys: score.acceptedInputKeys, methodology: score.methodology,
      classificationOnly: true,
    },
    invalidationConditions: [
      "A newer observation changes the composite regime.",
      "Input coverage or confidence falls below model policy.",
      "The configured calibration or model version is revised.",
    ],
  };
}
