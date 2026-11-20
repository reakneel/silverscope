import { cookies } from "next/headers";
export interface SupabaseAuthUser { id: string; email?: string; }
interface AuthTokenResponse { access_token: string; refresh_token: string; expires_in?: number; user?: SupabaseAuthUser; }
const ACCESS_COOKIE = "ss_access_token";
const REFRESH_COOKIE = "ss_refresh_token";
function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}
function authConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), anonKey };
}
export async function getCurrentSupabaseUser(): Promise<SupabaseAuthUser | null> {
  const config = authConfig();
  if (!config) return null;
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return null;
  const fetchUser = async (token: string) => fetch(`${config.baseUrl}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  let response = await fetchUser(accessToken);
  if (response.status === 401 && refreshToken) {
    const refreshed = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }), cache: "no-store",
    });
    if (!refreshed.ok) {
      store.delete(ACCESS_COOKIE); store.delete(REFRESH_COOKIE);
      return null;
    }
    const tokens = await refreshed.json() as AuthTokenResponse;
    if (!tokens.access_token || !tokens.refresh_token) return null;
    accessToken = tokens.access_token;
    store.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(tokens.expires_in ?? 3600));
    store.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 30));
    response = await fetchUser(accessToken);
  }
  if (!response.ok) return null;
  const user = await response.json() as SupabaseAuthUser;
  return user?.id ? { id: user.id, email: user.email } : null;
}
export function setSupabaseSessionCookies(store: Awaited<ReturnType<typeof cookies>>, tokens: AuthTokenResponse) {
  store.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(tokens.expires_in ?? 3600));
  store.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}
export function clearSupabaseSessionCookies(store: Awaited<ReturnType<typeof cookies>>) {
  store.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}
export function getSupabaseAuthConfig() { return authConfig(); }
