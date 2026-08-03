import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getServerEnvironment } from "@/lib/env";
import { inspectPasswordResetToken } from "@/server/auth/password-lifecycle";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  const status = await inspectPasswordResetToken(token);
  return (
    <main className="auth-page auth-page--compact" id="main-content">
      <section className="auth-page__manifesto">
        <span className="auth-kicker">Pemulihan akses</span>
        <h1>Satu tautan. Satu kesempatan.</h1>
        <p>Token tidak ditampilkan ulang, tidak disimpan mentah, dan tidak dapat digunakan setelah reset.</p>
      </section>
      <section className="auth-panel" aria-labelledby="reset-title">
        <div className="auth-panel__number">04</div>
        <div className="auth-panel__heading"><span>Status token · {status}</span><h2 id="reset-title">Reset password</h2></div>
        {status === "VALID" ? (
          <ResetPasswordForm token={token} maximumLength={getServerEnvironment().PASSWORD_MAX_LENGTH} />
        ) : (
          <div className="auth-terminal-state" role="alert">
            <strong>{status === "EXPIRED" ? "Tautan telah kedaluwarsa." : "Tautan tidak valid atau sudah digunakan."}</strong>
            <p>Minta tautan baru. Tidak ada perubahan yang dilakukan pada akun.</p>
            <Link className="auth-submit auth-submit--link" href="/admin/lupa-password">Minta reset baru</Link>
          </div>
        )}
        <Link className="auth-back-link" href="/admin/login">← Kembali ke login</Link>
      </section>
    </main>
  );
}

