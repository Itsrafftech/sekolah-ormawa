import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { requireAdminPage } from "@/server/auth/page-guard";
import { listCandidateOwningDepartments } from "@/server/candidates/departments";
import { resolveDashboardPeriod } from "@/server/candidates/period";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const context = await requireAdminPage();
  if (context.role !== "SUPER_ADMIN") redirect("/admin/tidak-berwenang");

  const [period, departments] = await Promise.all([
    resolveDashboardPeriod(),
    listCandidateOwningDepartments(),
  ]);

  return (
    <main className="admin-placeholder" id="main-content">
      <Link href="/admin/dashboard" className="candidate-detail__back"><ArrowLeft aria-hidden="true" size={15} /> Kembali ke dashboard</Link>
      <section className="admin-placeholder__intro">
        <span className="auth-kicker">Operasional / Phase 7</span>
        <h1>Broadcast Kandidat</h1>
        <p>Kirim pengumuman ke kandidat lewat email outbox, dengan preview wajib dan konfirmasi ganda sebelum terkirim.</p>
      </section>
      {period ? (
        <BroadcastComposer periodId={period.id} periodName={period.name} departments={departments} />
      ) : (
        <p className="candidate-dashboard__empty">Belum ada periode untuk broadcast.</p>
      )}
    </main>
  );
}
