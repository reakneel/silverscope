import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
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
  let body: { plan?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  const plan = body.plan === "pro" || body.plan === "ultra" ? body.plan : null;
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ULTRA;
  if (!secret || !priceId || !appUrl) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl.replace(/\/$/, "")}/pricing?checkout=success`,
    cancel_url: `${appUrl.replace(/\/$/, "")}/pricing?checkout=cancelled`,
    client_reference_id: user.id,
    "metadata[supabase_user_id]": user.id,
    "metadata[plan_key]": plan,
    "subscription_data[metadata][supabase_user_id]": user.id,
    "subscription_data[metadata][plan_key]": plan,
  });
  if (user.email) form.set("customer_email", user.email);
  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "checkout_session_failed" }, { status: 502 });
    const session = await response.json();
    if (!session.url || !session.id) return NextResponse.json({ error: "checkout_response_invalid" }, { status: 502 });
    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "billing_provider_unavailable" }, { status: 502 });
  }
}
