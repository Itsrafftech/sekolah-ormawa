"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { PasswordField } from "@/components/auth/password-field";

export function PasswordChangeForm({ maximumLength }: { maximumLength: number }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const meetsLength = newPassword.length >= 12 && newPassword.length <= maximumLength;
  const differs = Boolean(newPassword) && newPassword !== currentPassword;
  const matches = Boolean(confirmation) && confirmation === newPassword;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetsLength || !differs || !matches) {
      setError("Penuhi seluruh persyaratan password sebelum melanjutkan.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json() as { data?: { next?: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.next) {
        setError(result.error?.message ?? "Password tidak dapat diganti.");
        requestAnimationFrame(() => feedbackRef.current?.focus());
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    } catch {
      setError("Password tidak dapat diganti. Coba kembali.");
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <AuthFeedback feedbackRef={feedbackRef} message={error} />
      <PasswordField autoComplete="current-password" id="current-password" label="Password sementara/saat ini" name="currentPassword" value={currentPassword} onChange={setCurrentPassword} />
      <PasswordField autoComplete="new-password" id="new-password" label="Password baru" name="newPassword" value={newPassword} onChange={setNewPassword} describedBy="password-requirements" />
      <PasswordField autoComplete="new-password" id="confirm-password" label="Ulangi password baru" name="confirmation" value={confirmation} onChange={setConfirmation} />
      <ul className="password-requirements" id="password-requirements" aria-live="polite">
        <li data-met={meetsLength}><Check aria-hidden="true" size={14} /> 12-{maximumLength} karakter, tanpa pemotongan</li>
        <li data-met={differs}><Check aria-hidden="true" size={14} /> Berbeda dari password saat ini</li>
        <li data-met={matches}><Check aria-hidden="true" size={14} /> Konfirmasi sama</li>
      </ul>
      <button className="auth-submit" disabled={loading} type="submit">
        {loading ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : null}
        {loading ? "Mengganti & merotasi sesi..." : "Ganti password"}
      </button>
    </form>
  );
}

