"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "auth_not_configured" ? "Authentication is not configured yet." : "Sign-in failed. Check your credentials and email verification.");
      router.push("/pricing"); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in is temporarily unavailable.");
    } finally { setBusy(false); }
  }
  return <form className="auth-card" onSubmit={submit}>
    <div className="eyebrow">ACCOUNT ACCESS</div>
    <h1>Sign in to SilverScope</h1>
    <p>Use the email and password associated with your SilverScope account.</p>
    <label className="auth-field">Email address
      <input className="auth-input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
    </label>
    <label className="auth-field">Password
      <input className="auth-input" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} />
    </label>
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
    <button className="button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    <p className="auth-note">Account creation and password reset are managed through the configured Supabase Auth project.</p>
  </form>;
}
