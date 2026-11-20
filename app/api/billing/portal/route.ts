import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origin = request.headers.get("origin");
  if (origin && appUrl) {
    try { if (new URL(origin).origin !== new URL(appUrl).origin) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 }); }
    catch { return NextResponse.json({ error: "app_url_invalid" }, { status: 503 }); }
  }
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !appUrl) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  const subscriptionResponse = await supabaseAdminRequest(`subscriptions?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.stripe&select=provider_customer_id&limit=1`);
  if (!subscriptionResponse.ok) return NextResponse.json({ error: "subscription_lookup_failed" }, { status: 503 });
  const rows = await subscriptionResponse.json();
  const customerId = rows[0]?.provider_customer_id;
  if (!customerId) return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  const form = new URLSearchParams({
    customer: customerId,
    return_url: `${appUrl.replace(/\/$/, "")}/pricing`,
  });
  try {
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "billing_portal_failed" }, { status: 502 });
    const session = await response.json();
    if (!session.url) return NextResponse.json({ error: "billing_portal_response_invalid" }, { status: 502 });
    return NextResponse.json({ portalUrl: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "billing_provider_unavailable" }, { status: 502 });
  }
}
