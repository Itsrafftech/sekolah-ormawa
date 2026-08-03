"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { AuthFeedback } from "@/components/auth/auth-feedback";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { data?: { message?: string }; error?: { message?: string } };
      if (!response.ok) {
        setError(result.error?.message ?? "Permintaan tidak dapat diproses.");
      } else {
        setMessage(result.data?.message ?? "Jika akun terdaftar, instruksi reset telah dibuat.");
      }
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } catch {
      setError("Permintaan tidak dapat diproses. Coba kembali.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <AuthFeedback feedbackRef={feedbackRef} message={error} />
      <AuthFeedback feedbackRef={feedbackRef} message={message} tone="success" />
      <div className="auth-field">
        <label htmlFor="reset-email">Email akun Sekolah</label>
        <input
          autoComplete="email"
          id="reset-email"
          name="email"
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <button className="auth-submit" disabled={loading} type="submit">
        {loading ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <Send aria-hidden="true" size={18} />}
        {loading ? "Memproses..." : "Minta instruksi reset"}
      </button>
    </form>
  );
}

