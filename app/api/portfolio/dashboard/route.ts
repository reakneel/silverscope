import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
import { calculateAccountValuation, type HoldingInput } from "@/lib/portfolio/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AccountRow {
  id: string; provider: string; account_kind: string; display_name: string;
  base_currency: string; markets: string[]; status: string; account_ref_masked: string | null;
}
interface InstrumentRow { canonical_symbol: string; display_name: string; exchange: string; asset_class: string; }
interface PositionRow {
  account_id: string; instrument_id: string; as_of: string; total_quantity: number | string;
  cost_basis: number | string | null; imported_market_price: number | string | null;
  imported_market_value: number | string | null; currency: string;
  instrument: InstrumentRow | InstrumentRow[] | null;
}
interface CashRow { account_id: string; as_of: string; currency: string; total_cash: number | string; created_at: string; }

const numeric = (value: number | string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET() {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const accountsResponse = await supabaseAdminRequest(
      `portfolio_accounts?owner_id=eq.${encodeURIComponent(user.id)}&select=id,provider,account_kind,display_name,base_currency,markets,status,account_ref_masked&order=created_at.desc`
    );
    if (!accountsResponse.ok) return NextResponse.json({ error: "portfolio_accounts_unavailable" }, { status: 503 });
    const accounts = await accountsResponse.json() as AccountRow[];
    if (!accounts.length) return NextResponse.json({ accounts: [], summaries: [] }, { headers: { "Cache-Control": "no-store" } });

    const [positionsResponse, cashResponse] = await Promise.all([
      supabaseAdminRequest(`portfolio_position_snapshots?owner_id=eq.${encodeURIComponent(user.id)}&select=account_id,instrument_id,as_of,total_quantity,cost_basis,imported_market_price,imported_market_value,currency,instrument:portfolio_instruments(canonical_symbol,display_name,exchange,asset_class)&order=as_of.desc&limit=5000`),
      supabaseAdminRequest(`portfolio_cash_snapshots?owner_id=eq.${encodeURIComponent(user.id)}&select=account_id,as_of,currency,total_cash,created_at&order=as_of.desc,created_at.desc&limit=1000`),
    ]);
    if (!positionsResponse.ok || !cashResponse.ok) return NextResponse.json({ error: "portfolio_ledger_unavailable" }, { status: 503 });
    const positions = await positionsResponse.json() as PositionRow[];
    const cashRows = await cashResponse.json() as CashRow[];

    const summaries = accounts.map((account) => {
      const accountPositions = positions.filter((row) => row.account_id === account.id);
      const positionsAsOf = accountPositions.reduce<string | null>((latest, row) => !latest || Date.parse(row.as_of) > Date.parse(latest) ? row.as_of : latest, null);
      const latestPositions = positionsAsOf ? accountPositions.filter((row) => row.as_of === positionsAsOf) : [];
      const accountCashRows = cashRows.filter((row) => row.account_id === account.id);
      const latestCashByCurrency = new Map<string, CashRow>();
      for (const row of accountCashRows) if (!latestCashByCurrency.has(row.currency)) latestCashByCurrency.set(row.currency, row);
      const cashSnapshot = latestCashByCurrency.get(account.base_currency);
      const cashAsOf = cashSnapshot?.as_of ?? null;
      const cash = numeric(cashSnapshot?.total_cash ?? null);
      const holdings: HoldingInput[] = latestPositions.map((row) => {
        const relation = Array.isArray(row.instrument) ? row.instrument[0] : row.instrument;
        return {
          instrumentId: row.instrument_id,
          symbol: relation?.canonical_symbol ?? "UNKNOWN",
          name: relation?.display_name ?? relation?.canonical_symbol ?? "Unmapped instrument",
          quantity: numeric(row.total_quantity) ?? NaN,
          costBasis: numeric(row.cost_basis),
          importedMarketPrice: numeric(row.imported_market_price),
          importedMarketValue: numeric(row.imported_market_value),
          quotePrice: null,
          quoteStatus: "unavailable",
          quoteObservedAt: null,
          currency: row.currency,
        };
      });
      const valuation = calculateAccountValuation({
        holdings, cash, currency: account.base_currency, asOf: positionsAsOf,
      });
      return {
        account,
        valuation: valuation.account,
        holdings: valuation.holdings,
        positionsAsOf,
        cashAsOf,
        foreignCurrencyCashCount: [...latestCashByCurrency.keys()].filter((currency) => currency !== account.base_currency).length,
        source: "broker_statement_snapshot",
      };
    });
    return NextResponse.json({ accounts, summaries }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "portfolio_dashboard_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
