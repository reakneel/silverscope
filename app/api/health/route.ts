import { NextResponse } from "next/server";
import { SOURCE_REGISTRY } from "@/lib/data/source-registry";
export const dynamic = "force-dynamic";
export function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const fredConfigured = Boolean(process.env.FRED_API_KEY);
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const ingestionConfigured = supabaseConfigured && fredConfigured && cronConfigured;
  return NextResponse.json({
    service: "silverscope",
    status: ingestionConfigured ? "ready" : "degraded",
    checkedAt: new Date().toISOString(),
    capabilities: {
      databaseConfigured: supabaseConfigured,
      fredApiKeyConfigured: fredConfigured,
      cronSecretConfigured: cronConfigured,
      ingestionRouteConfigured: ingestionConfigured,
      registeredSources: SOURCE_REGISTRY.length,
      scoringEngine: "available",
      liveMarketData: false,
      billing: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
    note: "Configuration presence does not prove credential validity or imply that market data has been ingested.",
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
