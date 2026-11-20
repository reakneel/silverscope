export async function supabaseUserRequest(path: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("Supabase client configuration is missing.");
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
}
