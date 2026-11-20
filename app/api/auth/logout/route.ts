import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSupabaseSessionCookies, getSupabaseAuthConfig } from "@/lib/auth/supabase-session";
export async function POST() {
  const store = await cookies();
  const accessToken = store.get("ss_access_token")?.value;
  const config = getSupabaseAuthConfig();
  if (accessToken && config) {
    try { await fetch(`${config.baseUrl}/auth/v1/logout`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store" }); } catch { /* Local cookies are still cleared if provider logout is unavailable. */ }
  }
  clearSupabaseSessionCookies(store);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
