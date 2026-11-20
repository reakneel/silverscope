import { NextResponse } from "next/server";
import { getCurrentSupabaseUser, getSupabaseUserAccessToken } from "@/lib/auth/supabase-session";
import { getUserEntitlements } from "@/lib/auth/authorization";
import { supabaseUserRequest } from "@/lib/supabase/user";
export const runtime = "nodejs";
const ALLOWED_ALERT_TYPES = new Set(["price_level", "indicator_threshold", "signal_regime"]);
export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const entitlements = await getUserEntitlements(user.id);
    if (!entitlements.canCreateAlerts) return NextResponse.json({ error: "plan_upgrade_required" }, { status: 403 });
    const token = await getSupabaseUserAccessToken();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const response = await supabaseUserRequest(`alerts?select=id,alert_type,configuration,enabled,last_triggered_at,created_at&order=created_at.desc&limit=${entitlements.maxAlerts}`, token);
    if (!response.ok) return NextResponse.json({ error: "alerts_lookup_failed" }, { status: 503 });
    return NextResponse.json({ alerts: await response.json(), entitlements }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "alerts_unavailable" }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { alertType?: string; configuration?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body.alertType || !ALLOWED_ALERT_TYPES.has(body.alertType) || !body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration)) {
    return NextResponse.json({ error: "invalid_alert" }, { status: 400 });
  }
  if (JSON.stringify(body.configuration).length > 8192) return NextResponse.json({ error: "configuration_too_large" }, { status: 413 });
  try {
    const entitlements = await getUserEntitlements(user.id);
    if (!entitlements.canCreateAlerts) return NextResponse.json({ error: "plan_upgrade_required" }, { status: 403 });
    const token = await getSupabaseUserAccessToken();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const existing = await supabaseUserRequest("alerts?select=id&limit=51", token);
    if (!existing.ok) return NextResponse.json({ error: "alerts_lookup_failed" }, { status: 503 });
    if ((await existing.json()).length >= entitlements.maxAlerts) return NextResponse.json({ error: "alert_quota_reached", limit: entitlements.maxAlerts }, { status: 429 });
    const response = await supabaseUserRequest("alerts", token, {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ user_id: user.id, alert_type: body.alertType, configuration: body.configuration, enabled: true }]),
    });
    if (!response.ok) return NextResponse.json({ error: "alert_create_failed" }, { status: 503 });
    const rows = await response.json();
    return NextResponse.json({ alert: rows[0] }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "alert_create_unavailable" }, { status: 503 });
  }
}
