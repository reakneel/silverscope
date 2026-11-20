import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error("database_not_configured");
  return { baseUrl: baseUrl.replace(/\/$/, ""), key };
}
async function count(path: string): Promise<number> {
  const { baseUrl, key } = config();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" }, cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase count failed (HTTP ${response.status}): ${(await response.text()).slice(0, 200)}`);
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/").pop());
  if (!Number.isFinite(total)) throw new Error("Supabase did not return an exact count.");
  return total;
}
async function rest(path: string, method = "GET", body?: unknown, prefer?: string) {
  const { baseUrl, key } = config();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase REST ${method} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 200)}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const checkedAt = new Date();
    const windowStart = new Date(checkedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = encodeURIComponent(windowStart.toISOString());
    const [observations, missingPublishedAt, nonVerified, runs] = await Promise.all([
      count(`observation_history?select=id&observed_at=gte.${from}`),
      count(`observation_history?select=id&observed_at=gte.${from}&published_at=is.null`),
      count(`observation_history?select=id&observed_at=gte.${from}&status=neq.verified`),
      rest(`ingestion_runs?select=fetched_count,accepted_count,rejected_count&started_at=gte.${from}&limit=1000`) as Promise<Array<Record<string, unknown>>>,
    ]);
    const totals = (runs ?? []).reduce((sum, run) => ({
      fetched: sum.fetched + Number(run.fetched_count ?? 0),
      accepted: sum.accepted + Number(run.accepted_count ?? 0),
      rejected: sum.rejected + Number(run.rejected_count ?? 0),
    }), { fetched: 0, accepted: 0, rejected: 0 });
    const rejectedRatio = totals.fetched > 0 ? totals.rejected / totals.fetched : null;
    const publicationCoverage = observations > 0 ? (observations - missingPublishedAt) / observations : null;
    const status = observations === 0 ? "insufficient_data" : (rejectedRatio !== null && rejectedRatio > 0.05 ? "degraded" : "healthy");
    const metrics = {
      windowDays: 30, ingestionRuns: runs?.length ?? 0, pointInTimeEligibleObservations: observations - missingPublishedAt,
      pointInTimePublicationTimestampCoverage: publicationCoverage,
      note: "Missing published_at is reported as a point-in-time limitation, not silently inferred from observed_at.",
    };
    const row = {
      checked_at: checkedAt.toISOString(), window_start: windowStart.toISOString(), status,
      observation_count: observations, missing_published_at_count: missingPublishedAt,
      non_verified_count: nonVerified, fetched_count: totals.fetched, accepted_count: totals.accepted,
      rejected_count: totals.rejected, rejected_ratio: rejectedRatio,
      publication_timestamp_coverage: publicationCoverage, metrics,
    };
    const persisted = await rest("data_quality_checks", "POST", [row], "return=representation") as Array<{ id: string }> | null;
    return NextResponse.json({ ...row, id: persisted?.[0]?.id ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "data_quality_monitor_failed", message: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
export const POST = GET;
