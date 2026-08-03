"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { PasswordField } from "@/components/auth/password-field";

export function ResetPasswordForm({ token, maximumLength }: { token: string; maximumLength: number }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const meetsLength = newPassword.length >= 12 && newPassword.length <= maximumLength;
  const matches = Boolean(confirmation) && newPassword === confirmation;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetsLength || !matches) {
      setError("Password baru belum memenuhi persyaratan.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await response.json() as { data?: { next?: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.next) {
        setError(result.error?.message ?? "Tautan reset tidak valid atau kedaluwarsa.");
        requestAnimationFrame(() => feedbackRef.current?.focus());
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    } catch {
      setError("Reset tidak dapat diproses. Coba kembali.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <AuthFeedback feedbackRef={feedbackRef} message={error} />
      <PasswordField autoComplete="new-password" id="reset-new-password" label="Password baru" name="newPassword" value={newPassword} onChange={setNewPassword} describedBy="reset-password-requirements" />
      <PasswordField autoComplete="new-password" id="reset-confirm-password" label="Ulangi password baru" name="confirmation" value={confirmation} onChange={setConfirmation} />
      <ul className="password-requirements" id="reset-password-requirements" aria-live="polite">
        <li data-met={meetsLength}><Check aria-hidden="true" size={14} /> 12-{maximumLength} karakter</li>
        <li data-met={matches}><Check aria-hidden="true" size={14} /> Kedua input sama</li>
      </ul>
      <button className="auth-submit" disabled={loading} type="submit">
        {loading ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : null}
        {loading ? "Mereset password..." : "Simpan password baru"}
      </button>
    </form>
  );
}

