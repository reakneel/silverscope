export type PlanKey = "free" | "pro" | "ultra";
export interface SubscriptionEntitlementInput {
  planKey?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | null;
}
export interface Entitlements {
  plan: PlanKey;
  subscriptionActive: boolean;
  canAccessFullSignals: boolean;
  canAccessScenarioResearch: boolean;
  canAccessApi: boolean;
  canCreateAlerts: boolean;
}
export function resolveEntitlements(input: SubscriptionEntitlementInput = {}): Entitlements {
  const requestedPlan: PlanKey = input.planKey === "pro" || input.planKey === "ultra" ? input.planKey : "free";
  const activeStatus = input.status === "active" || input.status === "trialing";
  const periodValid = input.currentPeriodEnd === null || input.currentPeriodEnd === undefined ||
    (Number.isFinite(Date.parse(input.currentPeriodEnd)) && Date.parse(input.currentPeriodEnd) > Date.now());
  const plan: PlanKey = activeStatus && periodValid ? requestedPlan : "free";
  return {
    plan,
    subscriptionActive: plan !== "free",
    canAccessFullSignals: plan === "pro" || plan === "ultra",
    canAccessScenarioResearch: plan === "ultra",
    canAccessApi: plan === "ultra",
    canCreateAlerts: plan === "pro" || plan === "ultra",
  };
}
