import { NextResponse } from "next/server";
import { getCurrentSupabaseUser, getSupabaseUserAccessToken } from "@/lib/auth/supabase-session";
import { supabaseUserRequest } from "@/lib/supabase/user";
export const runtime = "nodejs";
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid_alert_id" }, { status: 400 });
  const token = await getSupabaseUserAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const response = await supabaseUserRequest(`alerts?id=eq.${encodeURIComponent(id)}`, token, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!response.ok) return NextResponse.json({ error: "alert_delete_failed" }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
