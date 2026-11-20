import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/billing/stripe-webhook";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function planFromPrice(priceId?: string): "pro" | "ultra" | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_ULTRA) return "ultra";
  return null;
}
async function patchEvent(eventId: string, status: "processed" | "failed", error?: string) {
  return supabaseAdminRequest(`stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, processed_at: status === "processed" ? new Date().toISOString() : null, error_summary: error?.slice(0, 300) ?? null }),
  });
}
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  if (typeof event.id !== "string" || typeof event.type !== "string") return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  try {
    const claim = await supabaseAdminRequest("stripe_webhook_events?on_conflict=event_id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify([{ event_id: event.id, event_type: event.type, status: "processing", received_at: new Date().toISOString() }]),
    });
    if (!claim.ok) return NextResponse.json({ error: "event_claim_failed" }, { status: 503 });
    const claimedRows = await claim.json();
    if (!claimedRows?.length) {
      const existing = await supabaseAdminRequest(`stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}&select=status&limit=1`);
      if (!existing.ok) return NextResponse.json({ error: "event_lookup_failed" }, { status: 503 });
      const rows = await existing.json();
      if (!rows[0]) return NextResponse.json({ error: "event_claim_state_missing" }, { status: 503 });
      if (rows[0]?.status === "processed") return NextResponse.json({ received: true, duplicate: true });
      if (rows[0]?.status === "processing") return NextResponse.json({ error: "event_processing" }, { status: 409 });
      const retry = await supabaseAdminRequest(`stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "processing", received_at: new Date().toISOString(), error_summary: null }),
      });
      if (!retry.ok) return NextResponse.json({ error: "event_retry_claim_failed" }, { status: 503 });
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data?.object;
      const userId = subscription?.metadata?.supabase_user_id;
      const priceId = subscription?.items?.data?.[0]?.price?.id;
      const plan = subscription?.metadata?.plan_key === "pro" || subscription?.metadata?.plan_key === "ultra"
        ? subscription.metadata.plan_key : planFromPrice(priceId);
      if (typeof userId === "string" && plan) {
        const status = event.type === "customer.subscription.deleted" ? "canceled" : String(subscription.status ?? "inactive");
        const periodEnd = typeof subscription.current_period_end === "number"
          ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
        const saved = await supabaseAdminRequest("subscriptions?on_conflict=user_id,provider", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{
            user_id: userId, provider: "stripe", provider_customer_id: customerId,
            provider_subscription_id: subscription.id, plan_key: plan, status, current_period_end: periodEnd,
          }]),
        });
        if (!saved.ok) throw new Error("subscription_persistence_failed");
      }
    }
    const completed = await patchEvent(event.id, "processed");
    if (!completed.ok) return NextResponse.json({ error: "event_finalize_failed" }, { status: 503 });
    return NextResponse.json({ received: true });
  } catch {
    await patchEvent(event.id, "failed", "Webhook processing failed");
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
