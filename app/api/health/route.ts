import { NextResponse } from "next/server";
import { SOURCE_REGISTRY } from "@/lib/data/source-registry";
export const dynamic = "force-dynamic";
export function GET() {
  const databaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const clientDatabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const fredConfigured = Boolean(process.env.FRED_API_KEY);
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const calibrationConfigured = Boolean(process.env.SILVER_FEATURE_CALIBRATION_JSON);
  const fredIngestionConfigured = databaseConfigured && fredConfigured && cronConfigured;
  const cftcIngestionConfigured = databaseConfigured && cronConfigured;
  const scoringPipelineConfigured = databaseConfigured && cronConfigured && calibrationConfigured;
  const allCoreConfigured = databaseConfigured && cronConfigured && calibrationConfigured;
  return NextResponse.json({
    service: "silverscope",
    status: allCoreConfigured ? "ready" : "degraded",
    checkedAt: new Date().toISOString(),
    capabilities: {
      databaseConfigured,
      clientDatabaseConfigured,
      fredApiKeyConfigured: fredConfigured,
      cronSecretConfigured: cronConfigured,
      featureCalibrationConfigured: calibrationConfigured,
      fredIngestionConfigured,
      cftcIngestionConfigured,
      scoringPipelineConfigured,
      scheduledIngestionConfigured: databaseConfigured && cronConfigured,
      sourceMonitoringConfigured: databaseConfigured && cronConfigured,
      historicalWarehouse: "local_operator_managed",
      automatedDatabaseArchival: false,
      storageBackup: "local_operator_managed",
      registeredSources: SOURCE_REGISTRY.length,
      scoringEngine: "available",
      liveMarketData: false,
      auth: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      billing: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_PRO && process.env.STRIPE_PRICE_ULTRA && process.env.STRIPE_PRICE_PRO_DISPLAY && process.env.STRIPE_PRICE_ULTRA_DISPLAY && process.env.NEXT_PUBLIC_APP_URL && databaseConfigured),
    },
    note: "Configuration presence does not prove credential validity or imply that market data has been ingested.",
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
