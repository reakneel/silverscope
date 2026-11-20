import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
import { resolveEntitlements } from "@/lib/billing/entitlements";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let subscription = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const response = await supabaseAdminRequest(`subscriptions?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.stripe&select=plan_key,status,current_period_end&limit=1`);
    if (!response.ok) return NextResponse.json({ error: "subscription_lookup_failed" }, { status: 503 });
    const rows = await response.json();
    subscription = rows[0] ?? null;
  }
  return NextResponse.json({
    user, entitlements: resolveEntitlements({
      planKey: subscription?.plan_key, status: subscription?.status, currentPeriodEnd: subscription?.current_period_end,
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
