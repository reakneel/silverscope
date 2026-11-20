import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SOURCE_CADENCE_POLICY } from "@/lib/monitoring/source-cadence";
import { evaluateSourceHealth, summarizeSourceHealth, type IngestionRunStatus } from "@/lib/monitoring/source-health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function config() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error("database_not_configured");
  return { baseUrl: baseUrl.replace(/\/$/, ""), key };
}
async function rest(path: string, method = "GET", body?: unknown, prefer?: string) {
  const { baseUrl, key } = config();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase REST ${method} ${path} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 240)}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [sources, runs] = await Promise.all([
      rest("data_sources?select=id,enabled,license_status,last_success_at&order=id.asc") as Promise<Array<Record<string, unknown>>>,
      rest("ingestion_runs?select=source_id,status,started_at,completed_at,error_summary&order=started_at.desc&limit=1000") as Promise<Array<Record<string, unknown>>>,
    ]);
    const latest = new Map<string, Record<string, unknown>>();
    for (const run of runs ?? []) {
      const id = String(run.source_id);
      if (!latest.has(id)) latest.set(id, run);
    }
    const now = new Date().toISOString();
    const results = (sources ?? []).map((source) => {
      const sourceId = String(source.id);
      const run = latest.get(sourceId);
      const rawStatus = run?.status;
      const lastRunStatus: IngestionRunStatus | null = rawStatus === "succeeded" || rawStatus === "partial" || rawStatus === "failed" ? rawStatus : null;
      return evaluateSourceHealth({
        sourceId, enabled: source.enabled === true,
        licenseStatus: source.license_status as "unverified" | "public_api" | "licensed" | "restricted",
        expectedIntervalMs: SOURCE_CADENCE_POLICY[sourceId] ?? null,
        lastSuccessAt: source.last_success_at ? String(source.last_success_at) : null,
        lastAttemptAt: run?.started_at ? String(run.started_at) : null,
        lastRunStatus, lastError: run?.error_summary ? String(run.error_summary) : null, now,
      });
    });
    const inserted = await rest("source_health_checks", "POST", results.map((result) => ({
      source_id: result.sourceId, checked_at: now, status: result.status, age_ms: result.ageMs,
      expected_interval_ms: result.expectedIntervalMs, last_success_at: result.lastSuccessAt,
      last_attempt_at: result.lastAttemptAt, last_run_status: result.lastRunStatus, alerts: result.alerts,
    })), "return=representation") as Array<{ id: string; source_id: string }> | null;
    const checkIds = new Map((inserted ?? []).map((row) => [row.source_id, row.id]));
    const alerts = results.flatMap((result) => result.alerts.map((alert) => ({
      check_id: checkIds.get(result.sourceId), source_id: alert.sourceId,
      severity: alert.severity, code: alert.code, message: alert.message,
    }))).filter((alert) => alert.check_id);
    if (alerts.length) await rest("source_health_alerts", "POST", alerts, "return=minimal");
    const summary = summarizeSourceHealth(results, now);
    return NextResponse.json({ ...summary, persistedChecks: inserted?.length ?? 0, persistedAlerts: alerts.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "source_monitor_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
export const POST = GET;
