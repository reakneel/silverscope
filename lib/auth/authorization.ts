import { resolveEntitlements, type Entitlements } from "../billing/entitlements";
import { supabaseAdminRequest } from "../supabase/admin";
export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const response = await supabaseAdminRequest(`subscriptions?user_id=eq.${encodeURIComponent(userId)}&provider=eq.stripe&select=plan_key,status,current_period_end&limit=1`);
  if (!response.ok) throw new Error("subscription_lookup_failed");
  const rows = await response.json();
  const subscription = rows[0];
  return resolveEntitlements({
    planKey: subscription?.plan_key,
    status: subscription?.status,
    currentPeriodEnd: subscription?.current_period_end,
  });
}
