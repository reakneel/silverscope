"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
interface SessionState { user: { id: string; email?: string }; entitlements: { plan: string; subscriptionActive: boolean } }
export function SessionMenu({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!authConfigured) { setLoaded(true); return; }
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() : null)
      .then((value) => setSession(value?.user ? value as SessionState : null))
      .catch(() => setSession(null))
      .finally(() => setLoaded(true));
  }, [authConfigured]);
  async function logout() {
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); setSession(null); router.refresh(); }
    finally { setBusy(false); }
  }
  async function manageSubscription() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = await response.json();
      if (response.ok && result.portalUrl) window.location.assign(result.portalUrl);
    } finally { setBusy(false); }
  }
  if (!authConfigured) return <span className="session-status">AUTH NOT CONFIGURED</span>;
  if (!loaded) return <span className="session-status">CHECKING SESSION</span>;
  if (!session) return <Link href="/login" className="session-button">Sign in</Link>;
  return <div className="session-menu">
    <span className="session-email">{session.user.email ?? "Account"}</span>
    <span className="session-plan">{session.entitlements.plan.toUpperCase()}</span>
    {session.entitlements.subscriptionActive ? <button className="session-button" disabled={busy} onClick={manageSubscription}>Manage plan</button> : <Link href="/pricing" className="session-button">Upgrade</Link>}
    <button className="session-button" disabled={busy} onClick={logout}>Sign out</button>
  </div>;
}
