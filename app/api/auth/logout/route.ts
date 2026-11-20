import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSupabaseSessionCookies } from "@/lib/auth/supabase-session";
export async function POST() {
  clearSupabaseSessionCookies(await cookies());
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
