import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAuthConfig, setSupabaseSessionCookies } from "@/lib/auth/supabase-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body.email || !body.password || body.email.length > 320 || body.password.length > 1024) return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  const config = getSupabaseAuthConfig();
  if (!config) return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  try {
    const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    const tokens = await response.json();
    if (!tokens.access_token || !tokens.refresh_token || !tokens.user?.id) return NextResponse.json({ error: "auth_response_invalid" }, { status: 502 });
    setSupabaseSessionCookies(await cookies(), tokens);
    return NextResponse.json({ user: { id: tokens.user.id, email: tokens.user.email } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 502 });
  }
}
