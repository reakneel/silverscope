import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers = new Set(["huatai", "other_broker", "xueqiu"]);
const currencies = new Set(["CNY", "HKD", "USD"]);

export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const response = await supabaseAdminRequest(
      `portfolio_accounts?owner_id=eq.${encodeURIComponent(user.id)}&select=id,provider,account_kind,display_name,account_ref_masked,base_currency,markets,status,created_at&order=created_at.desc`
    );
    if (!response.ok) return NextResponse.json({ error: "portfolio_accounts_unavailable" }, { status: 503 });
    return NextResponse.json({ accounts: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "portfolio_accounts_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }

  const provider = typeof body.provider === "string" ? body.provider : "";
  const accountKind = provider === "xueqiu" ? "social_portfolio" : "brokerage";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const currency = typeof body.baseCurrency === "string" ? body.baseCurrency : "CNY";
  const markets = Array.isArray(body.markets) ? body.markets.filter((v): v is string => typeof v === "string" && ["CN", "HK", "US"].includes(v)) : ["CN"];
  const maskedRef = typeof body.maskedAccountRef === "string" ? body.maskedAccountRef.trim() : null;
  if (!providers.has(provider) || !displayName || displayName.length > 80 || !currencies.has(currency) || !markets.length || markets.length > 3 ||
      (maskedRef && (maskedRef.length > 40 || /\d{6,}/.test(maskedRef.replace(/[xX*•\s-]/g, ""))))) {
    return NextResponse.json({ error: "invalid_portfolio_account" }, { status: 400 });
  }

  try {
    const response = await supabaseAdminRequest("portfolio_accounts?select=id,provider,account_kind,display_name,account_ref_masked,base_currency,markets,status,created_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{
        owner_id: user.id, provider, account_kind: accountKind,
        display_name: displayName, account_ref_masked: maskedRef,
        base_currency: currency, markets, status: "pending",
      }]),
    });
    if (!response.ok) return NextResponse.json({ error: "portfolio_account_create_failed" }, { status: 503 });
    const rows = await response.json();
    return NextResponse.json({ account: rows[0] }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "portfolio_account_create_failed" }, { status: 503 });
  }
}
