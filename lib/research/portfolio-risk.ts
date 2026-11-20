export interface PortfolioPosition {
  contractId: string;
  /** Signed contracts: positive long, negative short. */
  contracts: number;
  markPrice: number;
  contractMultiplier: number;
  initialMarginRate: number;
  maintenanceMarginRate: number;
  /** Optional common risk bucket, e.g. precious-metals or energy. */
  riskGroup?: string;
}
export interface PortfolioRiskLimits {
  maxGrossNotional?: number;
  maxAbsoluteNetNotional?: number;
  maxInitialMargin?: number;
  maxContractsByInstrument?: number;
  maxRiskGroupGrossNotional?: number;
}
export interface PortfolioRiskSnapshot {
  equity: number;
  grossNotional: number;
  netNotional: number;
  initialMargin: number;
  maintenanceMargin: number;
  marginUtilization: number;
  positions: Array<{ contractId: string; signedNotional: number; grossNotional: number; initialMargin: number; maintenanceMargin: number }>;
  riskGroups: Record<string, number>;
  breaches: string[];
  withinLimits: boolean;
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
}
/**
 * Aggregates a point-in-time multi-contract account snapshot. Margin is additive per contract;
 * no offsets, spread credits or exchange SPAN assumptions are inferred.
 */
export function calculatePortfolioRisk(
  equity: number,
  positions: PortfolioPosition[],
  limits: PortfolioRiskLimits = {},
): PortfolioRiskSnapshot {
  positive(equity, "equity");
  const ids = new Set<string>();
  for (const p of positions) {
    if (!p.contractId || ids.has(p.contractId)) throw new Error("Positions must have unique, non-empty contractId values.");
    ids.add(p.contractId);
    if (!Number.isInteger(p.contracts)) throw new Error("contracts must be an integer.");
    positive(p.markPrice, "markPrice");
    positive(p.contractMultiplier, "contractMultiplier");
    if (!Number.isFinite(p.initialMarginRate) || p.initialMarginRate <= 0 || p.initialMarginRate >= 1) throw new Error("initialMarginRate must be in (0, 1).");
    if (!Number.isFinite(p.maintenanceMarginRate) || p.maintenanceMarginRate <= 0 || p.maintenanceMarginRate > p.initialMarginRate) throw new Error("maintenanceMarginRate must be in (0, initialMarginRate].");
  }
  for (const [name, value] of Object.entries(limits)) if (value !== undefined) positive(value, name);
  const detail = positions.map((p) => {
    const signedNotional = p.contracts * p.markPrice * p.contractMultiplier;
    const grossNotional = Math.abs(signedNotional);
    return {
      contractId: p.contractId, signedNotional, grossNotional,
      initialMargin: grossNotional * p.initialMarginRate,
      maintenanceMargin: grossNotional * p.maintenanceMarginRate,
    };
  });
  const grossNotional = detail.reduce((s, p) => s + p.grossNotional, 0);
  const netNotional = detail.reduce((s, p) => s + p.signedNotional, 0);
  const initialMargin = detail.reduce((s, p) => s + p.initialMargin, 0);
  const maintenanceMargin = detail.reduce((s, p) => s + p.maintenanceMargin, 0);
  const riskGroups: Record<string, number> = {};
  positions.forEach((p, i) => { if (p.riskGroup) riskGroups[p.riskGroup] = (riskGroups[p.riskGroup] ?? 0) + detail[i].grossNotional; });
  const breaches: string[] = [];
  if (limits.maxGrossNotional !== undefined && grossNotional > limits.maxGrossNotional) breaches.push("maxGrossNotional");
  if (limits.maxAbsoluteNetNotional !== undefined && Math.abs(netNotional) > limits.maxAbsoluteNetNotional) breaches.push("maxAbsoluteNetNotional");
  if (limits.maxInitialMargin !== undefined && initialMargin > limits.maxInitialMargin) breaches.push("maxInitialMargin");
  if (limits.maxContractsByInstrument !== undefined && positions.some((p) => Math.abs(p.contracts) > limits.maxContractsByInstrument!)) breaches.push("maxContractsByInstrument");
  if (limits.maxRiskGroupGrossNotional !== undefined && Object.values(riskGroups).some((v) => v > limits.maxRiskGroupGrossNotional!)) breaches.push("maxRiskGroupGrossNotional");
  return { equity, grossNotional, netNotional, initialMargin, maintenanceMargin, marginUtilization: initialMargin / equity, positions: detail, riskGroups, breaches, withinLimits: breaches.length === 0 };
}
