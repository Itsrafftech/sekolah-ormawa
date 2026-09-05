"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { PasswordField } from "@/components/auth/password-field";

export function LoginForm({ redirectTo, notice }: { redirectTo: string; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirectTo }),
      });
      const result = await response.json() as {
        data?: { next?: string };
        error?: { message?: string } | null;
      };
      if (!response.ok || !result.data?.next) {
        setError(result.error?.message ?? "Email atau password tidak valid.");
        requestAnimationFrame(() => feedbackRef.current?.focus());
        return;
      }
      // Hard navigation, not router.replace()+refresh(): a client-side
      // transition here leaves Next.js's Router Cache free to serve a
      // PREVIOUS session's already-visited pages (e.g. a candidate detail
      // page whose SelectionPanel action buttons had the old session's
      // departmentId baked in) even though the cookie now belongs to this
      // new session - the server then correctly rejects that stale
      // departmentId as out-of-scope (404 "Resource tidak ditemukan.").
      // Bug found via UAT (candidate detail page hitting that 404 for a PJ
      // whose account had just been switched in the same tab). A full
      // reload tears down the whole Router Cache, so no session-scoped
      // page can leak across the identity boundary.
      window.location.href = result.data.next;
    } catch {
      setError("Login tidak dapat diproses. Coba kembali.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {notice ? <AuthFeedback message={notice} tone="notice" /> : null}
      <AuthFeedback feedbackRef={feedbackRef} message={error} />
      <div className="auth-field">
        <label htmlFor="admin-email">Email akun Sekolah</label>
        <input
          autoComplete="username"
          id="admin-email"
          inputMode="email"
          name="email"
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <PasswordField
        autoComplete="current-password"
        id="admin-password"
        label="Password"
        name="password"
        value={password}
        onChange={setPassword}
      />
      <div className="auth-form__aside">
        <Link href="/admin/lupa-password">Lupa password?</Link>
        <span><LockKeyhole aria-hidden="true" size={14} /> Sesi hanya disimpan dalam cookie aman.</span>
      </div>
      <button className="auth-submit" disabled={loading} type="submit">
        {loading ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : null}
        {loading ? "Memverifikasi..." : "Masuk ke ruang kerja"}
        {!loading ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
    </form>
  );
}

