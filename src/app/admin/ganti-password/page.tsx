import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { getServerEnvironment } from "@/lib/env";
import { requireAdminPage } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const context = await requireAdminPage({ allowForcedPassword: true });
  return (
    <main className="auth-page auth-page--compact" id="main-content">
      <section className="auth-page__manifesto">
        <span className="auth-kicker">Rotasi credential</span>
        <h1>{context.mustChangePassword ? "Selesaikan login pertamamu." : "Perbarui kunci aksesmu."}</h1>
        <p>Setelah perubahan, semua sesi lama dicabut dan server menerbitkan sesi baru.</p>
        <div className="auth-identity-stamp"><span>{context.role}</span><strong>{context.name}</strong><small>{context.departmentName ?? "Scope seluruh organisasi"}</small></div>
      </section>
      <section className="auth-panel" aria-labelledby="change-title">
        <div className="auth-panel__number">03</div>
        <div className="auth-panel__heading"><span>Argon2id · 64 MiB · t=3</span><h2 id="change-title">Ganti password</h2></div>
        <PasswordChangeForm maximumLength={getServerEnvironment().PASSWORD_MAX_LENGTH} />
      </section>
    </main>
  );
}

