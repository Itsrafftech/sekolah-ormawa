import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { OverrideLockPanel } from "@/components/admin/override-lock-panel";
import { PeriodManager } from "@/components/admin/period-manager";
import { requireAdminPage } from "@/server/auth/page-guard";
import { listAllLockedCandidates, listDeletedCandidates } from "@/server/admin/candidate-admin";
import { listPeriods } from "@/server/admin/periods";

export const dynamic = "force-dynamic";

export default async function PeriodManagementPage() {
  const context = await requireAdminPage();
  if (context.role !== "SUPER_ADMIN") redirect("/admin/tidak-berwenang");

  const [periods, locks, deleted] = await Promise.all([
    listPeriods(),
    listAllLockedCandidates(),
    listDeletedCandidates(),
  ]);

  return (
    <main className="admin-placeholder" id="main-content">
      <Link href="/admin/dashboard" className="candidate-detail__back"><ArrowLeft aria-hidden="true" size={15} /> Kembali ke dashboard</Link>
      <section className="admin-placeholder__intro">
        <span className="auth-kicker">Operasional / Phase 7</span>
        <h1>Periode &amp; Override Lock</h1>
        <p>Kelola status dan konfigurasi periode rekrutmen, ketersediaan per Birdep, override lock lintas-Birdep, dan pemulihan kandidat terhapus.</p>
      </section>
      <PeriodManager initialPeriods={periods} />
      <OverrideLockPanel initialLocks={locks} initialDeleted={deleted} />
    </main>
  );
}
