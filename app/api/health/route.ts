import { NextResponse } from "next/server";
import { SOURCE_REGISTRY } from "@/lib/data/source-registry";
export const dynamic = "force-dynamic";
export function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const enabledSources = SOURCE_REGISTRY.filter((source) => source.enabled);
  return NextResponse.json({
    service: "silverscope",
    status: supabaseConfigured && enabledSources.length > 0 ? "ready" : "degraded",
    checkedAt: new Date().toISOString(),
    capabilities: {
      databaseConfigured: supabaseConfigured, ingestionSourcesEnabled: enabledSources.length,
      registeredSources: SOURCE_REGISTRY.length, scoringEngine: "available",
      liveMarketData: false, billing: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
    note: "A ready application process does not imply that market data is connected or that a score is available.",
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
