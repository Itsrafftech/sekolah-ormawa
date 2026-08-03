import Link from "next/link";
import { KeyRound, ShieldCheck, UserRoundCheck } from "lucide-react";

import { SessionActions } from "@/components/auth/session-actions";
import { requireAdminPage } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardShell() {
  const context = await requireAdminPage();
  return (
    <main className="admin-placeholder" id="main-content">
      <section className="admin-placeholder__intro">
        <span className="auth-kicker">Authenticated shell / Phase 4</span>
        <h1>Identitas terverifikasi. Fitur operasional belum dibuka.</h1>
        <p>Halaman ini hanya membuktikan session, role, permission, dan department scope. Tidak ada kandidat, statistik, lock, catatan, atau export.</p>
      </section>
      <section className="admin-context-card" aria-labelledby="context-title">
        <div className="admin-context-card__seal"><UserRoundCheck aria-hidden="true" size={30} /></div>
        <div><span>Pengguna aktif</span><h2 id="context-title">{context.name}</h2><p>{context.email}</p></div>
        <dl>
          <div><dt>Role</dt><dd>{context.role}</dd></div>
          <div><dt>Scope</dt><dd>{context.departmentName ?? "Seluruh organisasi"}</dd></div>
          <div><dt>Forced password</dt><dd>{context.mustChangePassword ? "Aktif" : "Selesai"}</dd></div>
        </dl>
      </section>
      <section className="permission-ledger" aria-labelledby="permission-title">
        <div className="permission-ledger__heading"><ShieldCheck aria-hidden="true" size={22} /><div><span>Effective policy</span><h2 id="permission-title">Permission dari server</h2></div></div>
        <ol>{context.permissions.map((permission, index) => <li key={permission}><span>{String(index + 1).padStart(2, "0")}</span><code>{permission}</code></li>)}</ol>
      </section>
      <section className="admin-shell-actions">
        <Link href="/admin/ganti-password"><KeyRound aria-hidden="true" size={17} /> Ganti password</Link>
        <SessionActions />
      </section>
      <aside className="phase-boundary-note"><strong>Batas Phase 4</strong><p>Dashboard kandidat, statistik, list/detail, lock, catatan, export, dan account management belum dibuat.</p></aside>
    </main>
  );
}

