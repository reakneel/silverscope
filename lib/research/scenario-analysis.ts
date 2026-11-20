import { calculateBacktestMetrics, type BacktestOptions, type BacktestMetrics, type EquityPoint } from "./backtest";
import { calculatePortfolioRisk, type PortfolioPosition } from "./portfolio-risk";
export interface PortfolioStressScenario {
  id: string;
  /** Percentage price shock by contract ID; omitted contracts receive a zero shock. */
  priceShockPct: Record<string, number>;
}
export interface PortfolioStressResult {
  scenarioId: string;
  stressedEquity: number;
  pnl: number;
  pnlByContract: Record<string, number>;
  grossNotional: number;
  initialMargin: number;
  maintenanceMargin: number;
  initialMarginShortfall: number;
  maintenanceMarginShortfall: number;
  maintenanceBreached: boolean;
  insolvent: boolean;
}
export function evaluatePortfolioScenarios(
  equity: number,
  positions: PortfolioPosition[],
  scenarios: PortfolioStressScenario[],
): PortfolioStressResult[] {
  calculatePortfolioRisk(equity, positions);
  if (!scenarios.length) throw new Error("At least one stress scenario is required.");
  const contractIds = new Set(positions.map((position) => position.contractId));
  const scenarioIds = new Set<string>();
  return scenarios.map((scenario) => {
    if (!scenario.id.trim() || scenarioIds.has(scenario.id)) throw new Error("Scenario IDs must be non-empty and unique.");
    scenarioIds.add(scenario.id);
    for (const [contractId, shock] of Object.entries(scenario.priceShockPct)) {
      if (!contractIds.has(contractId)) throw new Error(`Unknown contract in scenario: ${contractId}.`);
      if (!Number.isFinite(shock) || shock <= -1) throw new Error("Price shocks must be finite and greater than -100%.");
    }
    const pnlByContract: Record<string, number> = {};
    const shockedPositions = positions.map((position) => {
      const shock = scenario.priceShockPct[position.contractId] ?? 0;
      const shockedPrice = position.markPrice * (1 + shock);
      const pnl = position.contracts * (shockedPrice - position.markPrice) * position.contractMultiplier;
      pnlByContract[position.contractId] = pnl;
      return { ...position, markPrice: shockedPrice };
    });
    const pnl = Object.values(pnlByContract).reduce((sum, value) => sum + value, 0);
    const stressedEquity = equity + pnl;
    const grossNotional = shockedPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * p.contractMultiplier), 0);
    const initialMargin = shockedPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * p.contractMultiplier) * p.initialMarginRate, 0);
    const maintenanceMargin = shockedPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * p.contractMultiplier) * p.maintenanceMarginRate, 0);
    return {
      scenarioId: scenario.id, stressedEquity, pnl, pnlByContract, grossNotional, initialMargin, maintenanceMargin,
      initialMarginShortfall: Math.max(0, initialMargin - stressedEquity),
      maintenanceMarginShortfall: Math.max(0, maintenanceMargin - stressedEquity),
      maintenanceBreached: stressedEquity < maintenanceMargin,
      insolvent: stressedEquity <= 0,
    };
  });
}
export interface CostSensitivityResult {
  tradingCostBps: number;
  metrics: BacktestMetrics;
}
/** Reprices a fixed equity/turnover path under explicit fee+slippage cost assumptions. */
export function evaluateCostSensitivity(
  points: EquityPoint[],
  costScenariosBps: number[],
  options: Omit<BacktestOptions, "tradingCostBps"> = {},
): CostSensitivityResult[] {
  if (!costScenariosBps.length) throw new Error("At least one cost scenario is required.");
  const seen = new Set<number>();
  return costScenariosBps.map((tradingCostBps) => {
    if (!Number.isFinite(tradingCostBps) || tradingCostBps < 0 || seen.has(tradingCostBps)) throw new Error("Cost scenarios must be unique finite non-negative values.");
    seen.add(tradingCostBps);
    return { tradingCostBps, metrics: calculateBacktestMetrics(points, { ...options, tradingCostBps }) };
  });
}
