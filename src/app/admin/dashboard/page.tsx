import Link from "next/link";
import { KeyRound, Megaphone, ShieldAlert, ShieldCheck, UserCog, UserRoundCheck } from "lucide-react";

import { CandidateDashboard } from "@/components/admin/candidate-dashboard";
import { SessionActions } from "@/components/auth/session-actions";
import { requireAdminPage } from "@/server/auth/page-guard";
import { listCandidateOwningDepartments } from "@/server/candidates/departments";
import { listCandidatesForDepartment } from "@/server/candidates/list";
import { resolveDashboardPeriod } from "@/server/candidates/period";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ departmentId?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const context = await requireAdminPage();
  const { departmentId: requestedDepartmentId } = await searchParams;

  const departments = context.role === "SUPER_ADMIN" ? await listCandidateOwningDepartments() : [];
  const departmentId: string | null =
    context.role === "DEPT_PJ"
      ? context.departmentId
      : (requestedDepartmentId && departments.some((department) => department.id === requestedDepartmentId)
          ? requestedDepartmentId
          : departments[0]?.id ?? null);

  const period = await resolveDashboardPeriod();
  const initialList =
    period && departmentId
      ? await listCandidatesForDepartment({
          departmentId,
          periodId: period.id,
          query: { segment: "PRIMARY", search: null, cursor: null, limit: 20, sort: "submittedAt_asc", departmentId },
        })
      : { items: [], nextCursor: null, counts: { PRIMARY: 0, SECONDARY: 0, LOCKED: 0 } };

  return (
    <main className="admin-placeholder" id="main-content">
      <section className="admin-placeholder__intro">
        <span className="auth-kicker">Authenticated shell / Phase 5</span>
        <h1>Dashboard PJ</h1>
        <p>Kandidat tersegmentasi berdasarkan pilihan Birdep, catatan terisolasi per Birdep, dan file viewer dengan otorisasi backend.</p>
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

      {departmentId ? (
        <CandidateDashboard
          role={context.role}
          departmentId={departmentId}
          departments={departments}
          periodName={period?.name ?? null}
          initialItems={initialList.items}
          initialCounts={initialList.counts}
          initialNextCursor={initialList.nextCursor}
        />
      ) : (
        <p className="candidate-dashboard__empty">
          {context.role === "SUPER_ADMIN"
            ? "Belum ada Birdep aktif untuk ditinjau."
            : "Scope Birdep tidak tersedia untuk akun ini."}
        </p>
      )}

      <section className="permission-ledger" aria-labelledby="permission-title">
        <div className="permission-ledger__heading"><ShieldCheck aria-hidden="true" size={22} /><div><span>Effective policy</span><h2 id="permission-title">Permission dari server</h2></div></div>
        <ol>{context.permissions.map((permission, index) => <li key={permission}><span>{String(index + 1).padStart(2, "0")}</span><code>{permission}</code></li>)}</ol>
      </section>

      {context.role === "SUPER_ADMIN" ? (
        <section className="admin-shell-actions">
          <Link href="/admin/dashboard/akun"><UserCog aria-hidden="true" size={17} /> Kelola akun PJ</Link>
          <Link href="/admin/dashboard/periode"><ShieldAlert aria-hidden="true" size={17} /> Periode &amp; override lock</Link>
          <Link href="/admin/dashboard/broadcast"><Megaphone aria-hidden="true" size={17} /> Broadcast</Link>
        </section>
      ) : null}

      <section className="admin-shell-actions">
        <Link href="/admin/ganti-password"><KeyRound aria-hidden="true" size={17} /> Ganti password</Link>
        <SessionActions />
      </section>
      <aside className="phase-boundary-note"><strong>Batas Phase 7</strong><p>Security hardening penuh, backup/restore drill, UAT, dan deployment readiness belum dibuat.</p></aside>
    </main>
  );
}
