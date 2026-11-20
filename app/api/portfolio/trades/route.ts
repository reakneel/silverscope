import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const response = await supabaseAdminRequest(
      `portfolio_transactions?owner_id=eq.${encodeURIComponent(user.id)}&select=id,account_id,event_type,trade_at,settled_at,quantity,unit_price,gross_amount,fees,taxes,currency,notes,instrument:portfolio_instruments(canonical_symbol,display_name,exchange)&order=trade_at.desc.nullslast&limit=1000`
    );
    if (!response.ok) return NextResponse.json({ error: "portfolio_transactions_unavailable" }, { status: 503 });
    return NextResponse.json({ transactions: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "portfolio_transactions_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
