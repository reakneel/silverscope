export type DataStatus = "verified" | "estimated" | "manual" | "stale" | "unavailable";
export type IndicatorGroup = "inventory_liquidity" | "macro" | "supply_demand" | "positioning";
export interface Observation {
  sourceId: string; indicatorKey: string; value: number; unit: string;
  observedAt: string; publishedAt: string | null; fetchedAt: string;
  confidence: number; status: DataStatus; sourceUrl?: string | null; sourceRecordId?: string | null;
}
export interface FeatureSignal {
  key: string; group: IndicatorGroup; score: number; confidence: number;
  observedAt: string; status: DataStatus; sourceId: string; explanation?: string;
}
export interface ValidationIssue { code: string; message: string; field?: string; }
export interface ValidationResult<T> { valid: boolean; value?: T; issues: ValidationIssue[]; }
