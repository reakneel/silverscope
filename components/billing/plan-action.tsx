"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PlanAction({ plan, billingConfigured }: { plan: "free" | "pro" | "ultra"; billingConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (plan === "free") return <Link href="/" className="button-secondary plan-action-link">Start exploring</Link>;
  if (!billingConfigured) return <button className="button-secondary" disabled>Checkout not configured</button>;
  async function checkout() {
    setBusy(true); setError("");
    try {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (me.status === 401) { router.push("/login"); return; }
      if (!me.ok) throw new Error("Unable to verify account. Try again.");
      const response = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
      });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error("Checkout is temporarily unavailable.");
      window.location.assign(result.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout is temporarily unavailable.");
    } finally { setBusy(false); }
  }
  return <div className="plan-action-wrap">
    <button className={plan === "pro" ? "button-primary" : "button-secondary"} onClick={checkout} disabled={busy}>{busy ? "Opening checkout…" : `Subscribe to ${plan.toUpperCase()}`}</button>
    {error ? <span className="plan-action-error" role="alert">{error}</span> : null}
  </div>;
}
