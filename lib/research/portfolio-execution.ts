export interface PortfolioExecutionBar {
  contractId: string;
  open: number;
  close: number;
  volume: number;
  /** Target position decided at this bar's close; executed from the next frame. */
  targetContracts: number;
  contractMultiplier: number;
  commissionPerContractPerSide: number;
  initialMarginRate: number;
  maintenanceMarginRate: number;
}
export interface PortfolioExecutionFrame {
  timestamp: string;
  bars: PortfolioExecutionBar[];
}
export interface PortfolioExecutionOptions {
  initialCapital: number;
  maxParticipationRate: number;
  slippageBps: number;
  maxContractsPerContract: number;
  allowShort?: boolean;
}
export interface PortfolioExecutionFill {
  timestamp: string;
  contractId: string;
  side: "buy" | "sell";
  contracts: number;
  remainingContracts: number;
  referencePrice: number;
  fillPrice: number;
  commission: number;
  slippageCost: number;
  reason: "rebalance" | "margin_liquidation" | "final_liquidation";
}
export interface PortfolioEquityPoint {
  timestamp: string;
  equity: number;
  grossNotional: number;
  netNotional: number;
  initialMargin: number;
  maintenanceMargin: number;
  maintenanceShortfall: number;
  openContracts: number;
  turnover: number;
}
export interface PortfolioExecutionResult {
  initialCapital: number;
  finalEquity: number;
  totalReturn: number;
  netPnl: number;
  fills: PortfolioExecutionFill[];
  equityCurve: PortfolioEquityPoint[];
  openPositions: Array<{ contractId: string; contracts: number; markPrice: number }>;
  fullyLiquidated: boolean;
  assumptions: PortfolioExecutionOptions;
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
}
function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative.`);
}
/**
 * Shared-equity, multi-contract futures simulator. Each frame contains a synchronized bar for
 * every open or newly targeted contract. Close targets execute at the next frame open, capped
 * by per-contract bar-volume participation. Unfilled targets remain outstanding as target-minus-
 * position deltas and are repriced at the next frame. Contract rolls are represented by closing
 * the old contract and opening the new contract as separate instruments with separate marks.
 */
export function simulatePortfolioExecution(
  frames: PortfolioExecutionFrame[],
  options: PortfolioExecutionOptions,
): PortfolioExecutionResult {
  positive(options.initialCapital, "initialCapital");
  if (!Number.isFinite(options.maxParticipationRate) || options.maxParticipationRate <= 0 || options.maxParticipationRate > 1) throw new Error("maxParticipationRate must be in (0, 1].");
  nonNegative(options.slippageBps, "slippageBps");
  if (!Number.isInteger(options.maxContractsPerContract) || options.maxContractsPerContract < 1) throw new Error("maxContractsPerContract must be a positive integer.");
  if (frames.length < 2) throw new Error("At least two synchronized frames are required.");
  const positions = new Map<string, number>();
  const targets = new Map<string, number>();
  const lastClose = new Map<string, number>();
  const specs = new Map<string, { multiplier: number; commission: number; initial: number; maintenance: number }>();
  const fills: PortfolioExecutionFill[] = [];
  const equityCurve: PortfolioEquityPoint[] = [];
  let equity = options.initialCapital;
  let previousTime = Number.NEGATIVE_INFINITY;
  const execute = (timestamp: string, bar: PortfolioExecutionBar, quantity: number, side: "buy" | "sell", referencePrice: number, reason: PortfolioExecutionFill["reason"], remainingContracts: number) => {
    if (quantity <= 0) return 0;
    const slip = options.slippageBps / 10_000;
    const fillPrice = referencePrice * (side === "buy" ? 1 + slip : 1 - slip);
    const commission = quantity * bar.commissionPerContractPerSide;
    const slippageCost = Math.abs(fillPrice - referencePrice) * quantity * bar.contractMultiplier;
    equity -= commission + slippageCost;
    fills.push({ timestamp, contractId: bar.contractId, side, contracts: quantity, remainingContracts, referencePrice, fillPrice, commission, slippageCost, reason });
    return quantity * referencePrice * bar.contractMultiplier;
  };
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    const time = Date.parse(frame.timestamp);
    if (!Number.isFinite(time) || time <= previousTime) throw new Error("Frames must have valid, strictly increasing timestamps.");
    previousTime = time;
    if (!frame.bars.length) throw new Error("Every frame must contain at least one contract bar.");
    const byId = new Map<string, PortfolioExecutionBar>();
    for (const bar of frame.bars) {
      if (!bar.contractId || byId.has(bar.contractId)) throw new Error("Contract IDs must be unique and non-empty within a frame.");
      positive(bar.open, "open"); positive(bar.close, "close"); positive(bar.contractMultiplier, "contractMultiplier");
      nonNegative(bar.volume, "volume"); nonNegative(bar.commissionPerContractPerSide, "commissionPerContractPerSide");
      if (!Number.isInteger(bar.targetContracts) || Math.abs(bar.targetContracts) > options.maxContractsPerContract) throw new Error("Target contracts must be an integer within maxContractsPerContract.");
      if (options.allowShort === false && bar.targetContracts < 0) throw new Error("Short positions are disabled.");
      if (!Number.isFinite(bar.initialMarginRate) || bar.initialMarginRate <= 0 || bar.initialMarginRate >= 1 ||
          !Number.isFinite(bar.maintenanceMarginRate) || bar.maintenanceMarginRate <= 0 || bar.maintenanceMarginRate > bar.initialMarginRate) {
        throw new Error("Margin rates must satisfy 0 < maintenance <= initial < 1.");
      }
      const spec = { multiplier: bar.contractMultiplier, commission: bar.commissionPerContractPerSide, initial: bar.initialMarginRate, maintenance: bar.maintenanceMarginRate };
      const existing = specs.get(bar.contractId);
      if (existing && (existing.multiplier !== spec.multiplier || existing.commission !== spec.commission || existing.initial !== spec.initial || existing.maintenance !== spec.maintenance)) {
        throw new Error(`Contract specification changed within the simulation: ${bar.contractId}.`);
      }
      specs.set(bar.contractId, spec);
      byId.set(bar.contractId, bar);
    }
    for (const [contractId, quantity] of positions) if (quantity !== 0 && !byId.has(contractId)) throw new Error(`Missing mark bar for open contract ${contractId}.`);
    for (const [contractId, target] of targets) if (target !== 0 && !byId.has(contractId)) throw new Error(`Missing execution bar for target contract ${contractId}.`);

    // Mark existing positions from prior close to current open.
    for (const [contractId, quantity] of positions) {
      if (!quantity) continue;
      const bar = byId.get(contractId)!;
      const prior = lastClose.get(contractId);
      if (prior === undefined) throw new Error(`Missing prior close for ${contractId}.`);
      equity += quantity * (bar.open - prior) * bar.contractMultiplier;
    }

    const capacityUsed = new Map<string, number>();
    const marginLiquidatedIds = new Set<string>();
    let tradedNotional = 0;
    for (const bar of [...frame.bars].sort((a, b) => a.contractId.localeCompare(b.contractId))) {
      const target = targets.get(bar.contractId) ?? 0;
      const current = positions.get(bar.contractId) ?? 0;
      const delta = target - current;
      if (!delta) continue;
      let quantity = Math.min(Math.abs(delta), Math.floor(bar.volume * options.maxParticipationRate));
      if (!quantity) continue;
      const candidate = current + Math.sign(delta) * quantity;
      if (Math.abs(candidate) > Math.abs(current)) {
        const otherMargin = [...positions.entries()].reduce((sum, [id, contracts]) => {
          if (id === bar.contractId || contracts === 0) return sum;
          const otherBar = byId.get(id)!;
          return sum + Math.abs(contracts) * otherBar.open * otherBar.contractMultiplier * otherBar.initialMarginRate;
        }, 0);
        const marginPerContract = bar.open * bar.contractMultiplier * bar.initialMarginRate;
        const maxAbsolute = Math.max(0, Math.floor((equity - otherMargin) / marginPerContract));
        const crossesThroughZero = current !== 0 && Math.sign(candidate) !== Math.sign(current);
        const allowedQuantity = crossesThroughZero ? Math.abs(current) + maxAbsolute : Math.max(0, maxAbsolute - Math.abs(current));
        quantity = Math.min(quantity, allowedQuantity);
      }
      if (!quantity) continue;
      const signedDelta = Math.sign(delta) * quantity;
      const nextPosition = current + signedDelta;
      const remaining = target - nextPosition;
      tradedNotional += execute(frame.timestamp, bar, quantity, signedDelta > 0 ? "buy" : "sell", bar.open, "rebalance", remaining);
      positions.set(bar.contractId, nextPosition);
      capacityUsed.set(bar.contractId, quantity);
    }

    // Mark all positions from current open to current close.
    for (const [contractId, quantity] of positions) {
      if (!quantity) continue;
      const bar = byId.get(contractId)!;
      equity += quantity * (bar.close - bar.open) * bar.contractMultiplier;
    }
    const marginAtClose = () => {
      let gross = 0, net = 0, initial = 0, maintenance = 0;
      for (const [contractId, quantity] of positions) {
        if (!quantity) continue;
        const bar = byId.get(contractId)!;
        const notional = quantity * bar.close * bar.contractMultiplier;
        gross += Math.abs(notional); net += notional;
        initial += Math.abs(notional) * bar.initialMarginRate;
        maintenance += Math.abs(notional) * bar.maintenanceMarginRate;
      }
      return { gross, net, initial, maintenance };
    };
    let margin = marginAtClose();
    if (equity < margin.maintenance) {
      const riskOrder = [...positions.entries()].filter(([, q]) => q !== 0).sort((a, b) => {
        const ba = byId.get(a[0])!, bb = byId.get(b[0])!;
        return Math.abs(b[1] * bb.close * bb.contractMultiplier * bb.maintenanceMarginRate) - Math.abs(a[1] * ba.close * ba.contractMultiplier * ba.maintenanceMarginRate);
      });
      for (const [contractId, current] of riskOrder) {
        const bar = byId.get(contractId)!;
        const used = capacityUsed.get(contractId) ?? 0;
        const available = Math.max(0, Math.floor(bar.volume * options.maxParticipationRate) - used);
        const quantity = Math.min(Math.abs(current), available);
        if (!quantity) continue;
        const next = current - Math.sign(current) * quantity;
        tradedNotional += execute(frame.timestamp, bar, quantity, current > 0 ? "sell" : "buy", bar.close, "margin_liquidation", next);
        positions.set(contractId, next);
        targets.set(contractId, 0);
        marginLiquidatedIds.add(contractId);
        capacityUsed.set(contractId, used + quantity);
        margin = marginAtClose();
        if (equity >= margin.maintenance) break;
      }
    }
    margin = marginAtClose();
    equityCurve.push({
      timestamp: frame.timestamp, equity, grossNotional: margin.gross, netNotional: margin.net,
      initialMargin: margin.initial, maintenanceMargin: margin.maintenance,
      maintenanceShortfall: Math.max(0, margin.maintenance - equity),
      openContracts: [...positions.values()].reduce((sum, q) => sum + Math.abs(q), 0),
      turnover: tradedNotional / Math.max(Math.abs(equity), 1e-12),
    });
    for (const bar of frame.bars) {
      lastClose.set(bar.contractId, bar.close);
      targets.set(bar.contractId, bar.targetContracts);
    }
    for (const contractId of marginLiquidatedIds) targets.set(contractId, 0);
    // A margin call overrides the close target; do not automatically re-open a liquidated position.
    if (equity < margin.maintenance) {
      for (const [contractId, quantity] of positions) if (quantity !== 0) targets.set(contractId, 0);
    }
  }

  const finalFrame = frames[frames.length - 1];
  const finalBars = new Map(finalFrame.bars.map((bar) => [bar.contractId, bar]));
  const usedAtEnd = new Map<string, number>();
  for (const fill of fills.filter((f) => f.timestamp === finalFrame.timestamp)) usedAtEnd.set(fill.contractId, (usedAtEnd.get(fill.contractId) ?? 0) + fill.contracts);
  for (const [contractId, current] of [...positions.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!current) continue;
    const bar = finalBars.get(contractId)!;
    const capacity = Math.floor(bar.volume * options.maxParticipationRate);
    const available = Math.max(0, capacity - (usedAtEnd.get(contractId) ?? 0));
    const quantity = Math.min(Math.abs(current), available);
    if (!quantity) continue;
    const next = current - Math.sign(current) * quantity;
    execute(finalFrame.timestamp, bar, quantity, current > 0 ? "sell" : "buy", bar.close, "final_liquidation", next);
    positions.set(contractId, next);
  }
  const finalOpenPositions = [...positions.entries()].filter(([, q]) => q !== 0).map(([contractId, contracts]) => ({
    contractId, contracts, markPrice: finalBars.get(contractId)!.close,
  }));
  const finalPoint = equityCurve[equityCurve.length - 1];
  if (finalPoint) {
    finalPoint.equity = equity;
    finalPoint.openContracts = finalOpenPositions.reduce((sum, p) => sum + Math.abs(p.contracts), 0);
    finalPoint.grossNotional = finalOpenPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * specs.get(p.contractId)!.multiplier), 0);
    finalPoint.netNotional = finalOpenPositions.reduce((sum, p) => sum + p.contracts * p.markPrice * specs.get(p.contractId)!.multiplier, 0);
    finalPoint.initialMargin = finalOpenPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * specs.get(p.contractId)!.multiplier) * specs.get(p.contractId)!.initial, 0);
    finalPoint.maintenanceMargin = finalOpenPositions.reduce((sum, p) => sum + Math.abs(p.contracts * p.markPrice * specs.get(p.contractId)!.multiplier) * specs.get(p.contractId)!.maintenance, 0);
    finalPoint.maintenanceShortfall = Math.max(0, finalPoint.maintenanceMargin - equity);
    const finalLiquidationNotional = fills.filter((fill) => fill.timestamp === finalFrame.timestamp && fill.reason === "final_liquidation").reduce((sum, fill) => sum + fill.contracts * fill.referencePrice * specs.get(fill.contractId)!.multiplier, 0);
    finalPoint.turnover += finalLiquidationNotional / Math.max(Math.abs(equity), 1e-12);
  }
  return {
    initialCapital: options.initialCapital, finalEquity: equity, totalReturn: equity / options.initialCapital - 1,
    netPnl: equity - options.initialCapital, fills, equityCurve,
    openPositions: finalOpenPositions, fullyLiquidated: finalOpenPositions.length === 0,
    assumptions: { ...options },
  };
}
