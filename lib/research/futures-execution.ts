export interface FuturesBar {
  timestamp: string;
  contractId: string;
  open: number;
  close: number;
  targetContracts: number;
}
export interface FuturesExecutionOptions {
  initialCapital: number;
  contractMultiplier: number;
  commissionPerContractPerSide: number;
  slippageBps: number;
  maxContracts: number;
  allowShort?: boolean;
}
export interface ExecutionFill {
  timestamp: string;
  contractId: string;
  side: "buy" | "sell";
  contracts: number;
  referencePrice: number;
  fillPrice: number;
  commission: number;
  slippageCost: number;
  reason: "rebalance" | "final_liquidation";
}
export interface FuturesEquityPoint {
  timestamp: string;
  equity: number;
  contracts: number;
  close: number;
  turnover: number;
}
export interface FuturesSimulationResult {
  initialCapital: number;
  finalEquity: number;
  totalReturn: number;
  netPnl: number;
  fills: ExecutionFill[];
  equityCurve: FuturesEquityPoint[];
  assumptions: FuturesExecutionOptions;
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
}
function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative.`);
}
/**
 * Close-of-bar target positions are executed at the next bar's open.
 * Futures P&L is marked from prior close to current open, then current open to close.
 * The final position is liquidated at the final close. Contract rolls are deliberately
 * rejected: callers must split simulations by contract and model roll spreads explicitly.
 */
export function simulateFuturesExecution(
  bars: FuturesBar[],
  options: FuturesExecutionOptions,
): FuturesSimulationResult {
  positive(options.initialCapital, "initialCapital");
  positive(options.contractMultiplier, "contractMultiplier");
  nonNegative(options.commissionPerContractPerSide, "commissionPerContractPerSide");
  nonNegative(options.slippageBps, "slippageBps");
  if (!Number.isInteger(options.maxContracts) || options.maxContracts < 1) throw new Error("maxContracts must be a positive integer.");
  if (bars.length < 2) throw new Error("At least two bars are required to execute next-bar signals.");
  const dates = bars.map((bar) => Date.parse(bar.timestamp));
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    positive(bar.open, "open");
    positive(bar.close, "close");
    if (!Number.isFinite(dates[i])) throw new Error("Every bar timestamp must be valid.");
    if (i && dates[i] <= dates[i - 1]) throw new Error("Bars must be strictly chronological and unique.");
    if (i && bar.contractId !== bars[i - 1].contractId) throw new Error("Contract changes require an explicit roll model; split the simulation by contract.");
    if (!Number.isInteger(bar.targetContracts)) throw new Error("targetContracts must be an integer.");
    if (Math.abs(bar.targetContracts) > options.maxContracts) throw new Error("Target position exceeds maxContracts.");
    if (options.allowShort === false && bar.targetContracts < 0) throw new Error("Short positions are disabled.");
  }
  let equity = options.initialCapital;
  let position = 0;
  const fills: ExecutionFill[] = [];
  const equityCurve: FuturesEquityPoint[] = [];
  const execute = (timestamp: string, contractId: string, referencePrice: number, target: number, reason: ExecutionFill["reason"]) => {
    const delta = target - position;
    if (!delta) return 0;
    const side = delta > 0 ? "buy" as const : "sell" as const;
    const quantity = Math.abs(delta);
    const slippageRate = options.slippageBps / 10_000;
    const fillPrice = referencePrice * (side === "buy" ? 1 + slippageRate : 1 - slippageRate);
    const commission = quantity * options.commissionPerContractPerSide;
    const slippageCost = Math.abs(fillPrice - referencePrice) * quantity * options.contractMultiplier;
    equity -= commission + slippageCost;
    fills.push({ timestamp, contractId, side, contracts: quantity, referencePrice, fillPrice, commission, slippageCost, reason });
    position = target;
    return quantity * referencePrice * options.contractMultiplier;
  };
  for (let i = 1; i < bars.length; i++) {
    const previous = bars[i - 1], bar = bars[i];
    equity += position * (bar.open - previous.close) * options.contractMultiplier;
    const target = previous.targetContracts;
    const tradedNotional = execute(bar.timestamp, bar.contractId, bar.open, target, "rebalance");
    equity += position * (bar.close - bar.open) * options.contractMultiplier;
    if (equity <= 0) throw new Error("Simulation equity reached zero or below.");
    equityCurve.push({ timestamp: bar.timestamp, equity, contracts: position, close: bar.close, turnover: tradedNotional / Math.max(equity, 1e-12) });
  }
  const last = bars[bars.length - 1];
  execute(last.timestamp, last.contractId, last.close, 0, "final_liquidation");
  if (equity <= 0) throw new Error("Final liquidation exhausted simulation equity.");
  const finalPoint = equityCurve[equityCurve.length - 1];
  if (finalPoint) { finalPoint.equity = equity; finalPoint.contracts = 0; }
  return {
    initialCapital: options.initialCapital, finalEquity: equity, totalReturn: equity / options.initialCapital - 1,
    netPnl: equity - options.initialCapital, fills, equityCurve,
    assumptions: { ...options },
  };
}
