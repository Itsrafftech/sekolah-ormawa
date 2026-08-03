import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { sanitizeAdminRedirect } from "@/features/auth/contracts";
import { requireAuthenticatedUser } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  logout: "Sesi saat ini telah dicabut.",
  revoked: "Seluruh sesi akun telah dicabut.",
  "reset-success": "Password berhasil direset. Silakan login dengan password baru.",
  "password-changed": "Password telah berubah. Silakan login kembali.",
  "session-expired": "Sesi berakhir. Silakan login kembali.",
  session_expired: "Sesi berakhir. Silakan login kembali.",
  session_revoked: "Sesi telah dicabut. Silakan login kembali.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  let activeContext: Awaited<ReturnType<typeof requireAuthenticatedUser>> | null = null;
  try {
    activeContext = await requireAuthenticatedUser();
  } catch {
    // Halaman login memang ditampilkan jika tidak ada session valid.
  }
  if (activeContext) {
    redirect(activeContext.mustChangePassword ? "/admin/ganti-password" : "/admin/dashboard");
  }
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-page__manifesto" aria-labelledby="login-title">
        <span className="auth-kicker">Akses terbatas / Phase 4</span>
        <h1 id="login-title">Masuk dengan identitasmu sendiri.</h1>
        <p>Satu akun untuk satu pengurus. Role dan scope Birdep selalu dihitung ulang oleh server.</p>
        <ol className="auth-trust-list">
          <li><span>01</span> Cookie HttpOnly</li>
          <li><span>02</span> Session dapat dicabut</li>
          <li><span>03</span> Permission server-side</li>
        </ol>
      </section>
      <section className="auth-panel" aria-label="Form login admin">
        <div className="auth-panel__number">01</div>
        <div className="auth-panel__heading"><span>Verifikasi akun</span><h2>Login admin</h2></div>
        <LoginForm redirectTo={sanitizeAdminRedirect(params.next)} notice={params.reason ? notices[params.reason] : undefined} />
        <p className="auth-panel__foot">Belum memiliki akun? Akun hanya dibuat Super Admin melalui workflow resmi pada fase berikutnya.</p>
        <Link className="auth-back-link" href="/">← Kembali ke kanal publik</Link>
      </section>
    </main>
  );
}
