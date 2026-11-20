export function getSupabaseAdminConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) throw new Error("Supabase admin configuration is missing.");
  return { baseUrl: baseUrl.replace(/\/$/, ""), serviceRoleKey };
}
export async function supabaseAdminRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}
