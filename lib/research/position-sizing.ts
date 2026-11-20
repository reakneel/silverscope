export interface FuturesPositionSizingInput {
  equity: number;
  riskFraction: number;
  entryPrice: number;
  stopPrice: number;
  contractMultiplier: number;
  maxContracts: number;
  initialMarginRate?: number;
}
export interface FuturesPositionSizingResult {
  contracts: number;
  riskBudget: number;
  riskPerContract: number;
  estimatedRisk: number;
  estimatedInitialMargin: number;
  limitingConstraint: "risk" | "margin" | "max_contracts" | "no_trade";
}

/** Conservative integer contract sizing from stop distance and optional initial margin. */
export function sizeFuturesPosition(input: FuturesPositionSizingInput): FuturesPositionSizingResult {
  const positive = (value: number, name: string) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
  };
  positive(input.equity, "equity");
  positive(input.entryPrice, "entryPrice");
  positive(input.stopPrice, "stopPrice");
  positive(input.contractMultiplier, "contractMultiplier");
  if (!Number.isFinite(input.riskFraction) || input.riskFraction <= 0 || input.riskFraction > 1) throw new Error("riskFraction must be in (0, 1].");
  if (!Number.isInteger(input.maxContracts) || input.maxContracts < 1) throw new Error("maxContracts must be a positive integer.");
  if (input.entryPrice === input.stopPrice) throw new Error("Stop price must differ from entry price.");
  if (input.initialMarginRate !== undefined && (!Number.isFinite(input.initialMarginRate) || input.initialMarginRate <= 0 || input.initialMarginRate >= 1)) throw new Error("initialMarginRate must be in (0, 1).");
  const riskPerContract = Math.abs(input.entryPrice - input.stopPrice) * input.contractMultiplier;
  const riskBudget = input.equity * input.riskFraction;
  const byRisk = Math.floor(riskBudget / riskPerContract);
  const marginPerContract = input.entryPrice * input.contractMultiplier * (input.initialMarginRate ?? 0);
  const byMargin = input.initialMarginRate === undefined ? Number.POSITIVE_INFINITY : Math.floor(input.equity / marginPerContract);
  const contracts = Math.max(0, Math.min(byRisk, byMargin, input.maxContracts));
  let limitingConstraint: FuturesPositionSizingResult["limitingConstraint"] = "no_trade";
  if (contracts > 0) {
    if (contracts === byRisk && byRisk <= byMargin && byRisk <= input.maxContracts) limitingConstraint = "risk";
    else if (contracts === byMargin && byMargin <= input.maxContracts) limitingConstraint = "margin";
    else limitingConstraint = "max_contracts";
  }
  return {
    contracts, riskBudget, riskPerContract, estimatedRisk: contracts * riskPerContract,
    estimatedInitialMargin: contracts * marginPerContract, limitingConstraint,
  };
}
