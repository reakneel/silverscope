export interface VolumeBar {
  timestamp: string;
  price: number;
  /** Exchange-reported traded contracts / units for this bar. */
  volume: number;
}
export interface VolumeExecutionFill {
  timestamp: string;
  side: "buy" | "sell";
  contracts: number;
  referencePrice: number;
  fillPrice: number;
  commission: number;
  slippageCost: number;
}
export interface VolumeConstrainedOrderResult {
  requestedContracts: number;
  filledContracts: number;
  remainingContracts: number;
  fills: VolumeExecutionFill[];
  totalCommission: number;
  totalSlippageCost: number;
}
function finiteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative.`);
}
function finitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive.`);
}
/**
 * Executes a signed market order over chronological bars using a hard volume-participation cap.
 * This models capacity only: it does not model queue priority, spread, impact or order-book depth.
 * Any unfilled quantity is returned explicitly and is never silently filled at the final bar.
 */
export function simulateVolumeConstrainedOrder(
  requestedContracts: number,
  bars: VolumeBar[],
  options: { maxParticipationRate: number; contractMultiplier: number; commissionPerContractPerSide: number; slippageBps: number },
): VolumeConstrainedOrderResult {
  if (!Number.isInteger(requestedContracts)) throw new Error("requestedContracts must be an integer.");
  if (!Number.isFinite(options.maxParticipationRate) || options.maxParticipationRate <= 0 || options.maxParticipationRate > 1) throw new Error("maxParticipationRate must be in (0, 1].");
  finitePositive(options.contractMultiplier, "contractMultiplier");
  finiteNonNegative(options.commissionPerContractPerSide, "commissionPerContractPerSide");
  finiteNonNegative(options.slippageBps, "slippageBps");
  let remaining = Math.abs(requestedContracts);
  const side = requestedContracts >= 0 ? "buy" as const : "sell" as const;
  const fills: VolumeExecutionFill[] = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const bar of bars) {
    finitePositive(bar.price, "price");
    finiteNonNegative(bar.volume, "volume");
    const time = Date.parse(bar.timestamp);
    if (!Number.isFinite(time) || time <= previousTime) throw new Error("Bars must have valid, strictly increasing timestamps.");
    previousTime = time;
    const capacity = Math.floor(bar.volume * options.maxParticipationRate);
    const quantity = Math.min(remaining, capacity);
    if (quantity === 0) continue;
    const slip = options.slippageBps / 10_000;
    const fillPrice = bar.price * (side === "buy" ? 1 + slip : 1 - slip);
    fills.push({
      timestamp: bar.timestamp, side, contracts: quantity, referencePrice: bar.price, fillPrice,
      commission: quantity * options.commissionPerContractPerSide,
      slippageCost: Math.abs(fillPrice - bar.price) * quantity * options.contractMultiplier,
    });
    remaining -= quantity;
    if (remaining === 0) break;
  }
  return {
    requestedContracts, filledContracts: Math.abs(requestedContracts) - remaining,
    remainingContracts: remaining, fills,
    totalCommission: fills.reduce((sum, fill) => sum + fill.commission, 0),
    totalSlippageCost: fills.reduce((sum, fill) => sum + fill.slippageCost, 0),
  };
}
