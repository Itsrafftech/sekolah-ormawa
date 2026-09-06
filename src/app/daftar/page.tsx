import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { RegistrationForm } from "@/components/registration/registration-form";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { createPublicMetadata } from "@/lib/public/metadata";
import { listDepartmentsByTrack } from "@/server/departments/public";
import { getRegistrationAvailability } from "@/server/registration/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...createPublicMetadata({
    title: "Pendaftaran",
    description: "Form pendaftaran Sekolah Ormawa Eksekutif PKU.",
    path: "/daftar",
  }),
  robots: { index: false, follow: false },
};

export default async function RegistrationPage() {
  const availability = await getRegistrationAvailability();
  // Phase B - "Jalur Legislatif": Step 0 (pilih jalur) and Step 2's
  // dropdown need every active department per track regardless of this
  // period's acceptsApplications (unlike availability.config.departments,
  // which is period-scoped) - same server function GET /api/departments
  // exposes (src/server/departments/public.ts), called directly here
  // rather than the page self-fetching its own API route.
  const departmentsByTrack = await listDepartmentsByTrack();

  return (
    <div className="public-site registration-site">
      <div className="preview-ribbon" role="status">
        <span>PHASE 3</span>
        <p>Submission hanya aktif untuk periode dan consent yang lolos gate server.</p>
      </div>
      <SiteHeader />
      <main className="registration-main" id="main-content">
        {availability.state === "OPEN" ? (
          <RegistrationForm config={availability.config} departmentsByTrack={departmentsByTrack} />
        ) : (
          <section className="registration-closed" aria-labelledby="registration-closed-title">
            <div className="registration-closed__mark" aria-hidden="true">
              <LockKeyhole size={42} strokeWidth={1.25} />
            </div>
            <p className="eyebrow">Form terkunci</p>
            <h1 id="registration-closed-title">{availability.title}</h1>
            <p>{availability.detail}</p>
            <div className="registration-closed__notice">
              <strong>Tidak ada data yang dapat dikirim.</strong>
              <span>Fixture, jadwal, dan consent berlabel DRAFT bukan informasi resmi.</span>
            </div>
            <Link className="button button--outline" href="/">
              <ArrowLeft aria-hidden="true" size={17} /> Kembali ke beranda
            </Link>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
