import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="auth-page auth-page--compact" id="main-content">
      <section className="auth-page__manifesto">
        <span className="auth-kicker">Pemulihan akses</span>
        <h1>Mulai ulang dengan aman.</h1>
        <p>Respons selalu sama agar keberadaan akun tidak dapat ditebak.</p>
      </section>
      <section className="auth-panel" aria-labelledby="forgot-title">
        <div className="auth-panel__number">02</div>
        <div className="auth-panel__heading">
          <span>Token sekali pakai</span>
          <h2 id="forgot-title">Lupa password</h2>
        </div>
        {reason === "temporary-expired" ? (
          <p className="auth-inline-notice">Password sementara telah kedaluwarsa. Minta tautan reset baru.</p>
        ) : null}
        <ForgotPasswordForm />
        <Link className="auth-back-link" href="/admin/login">← Kembali ke login</Link>
      </section>
    </main>
  );
}

