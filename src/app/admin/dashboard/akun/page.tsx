import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AccountManager } from "@/components/admin/account-manager";
import { requireAdminPage } from "@/server/auth/page-guard";
import { listAccounts } from "@/server/admin/accounts";
import { listCandidateOwningDepartments } from "@/server/candidates/departments";

export const dynamic = "force-dynamic";

export default async function AccountManagementPage() {
  const context = await requireAdminPage();
  if (context.role !== "SUPER_ADMIN") redirect("/admin/tidak-berwenang");

  const [accounts, departments] = await Promise.all([
    listAccounts(),
    listCandidateOwningDepartments(),
  ]);

  return (
    <main className="admin-placeholder" id="main-content">
      <Link href="/admin/dashboard" className="candidate-detail__back"><ArrowLeft aria-hidden="true" size={15} /> Kembali ke dashboard</Link>
      <section className="admin-placeholder__intro">
        <span className="auth-kicker">Operasional / Phase 7</span>
        <h1>Manajemen Akun PJ</h1>
        <p>Buat, nonaktifkan, kirim reset, dan cabut sesi akun PJ. Akun Super Admin baru tetap dibuat manual lewat database.</p>
      </section>
      <AccountManager initialAccounts={accounts} departments={departments} />
    </main>
  );
}
