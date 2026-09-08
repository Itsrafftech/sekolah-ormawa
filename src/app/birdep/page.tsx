import type { Metadata } from "next";

import { DepartmentGrid } from "@/components/public/department-grid";
import { PublicPageHero } from "@/components/public/public-page-hero";
import { RegistrationCta } from "@/components/public/registration-cta";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { createPublicMetadata } from "@/lib/public/metadata";
import { getPublicLandingData } from "@/lib/public/recruitment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPublicMetadata({
  title: "Direktori Birdep",
  description:
    "Direktori unit Ormawa PKU dan status slot Sekolah Ormawa berdasarkan periode aktif.",
  path: "/birdep",
});

export default async function BirdepDirectoryPage() {
  const publicData = await getPublicLandingData();

  return (
    <div className="public-site" id="top">
      <SiteHeader />
      <main id="main-content">
        <PublicPageHero
          description="Direktori bersumber langsung dari data organisasi. Label slot dibaca dari konfigurasi periode, bukan dari daftar yang ditanam di komponen."
          eyebrow="Direktori organisasi"
          index="02"
          title="Kenali profil unit, lalu periksa apakah slotnya tersedia."
        />
        <section className="directory-page section-pad">
          <div className="directory-page__legend">
            <p>
              <span className="slot-dot slot-dot--open" aria-hidden="true" />
              Membuka slot pada periode aktif
            </p>
            <p>
              <span className="slot-dot" aria-hidden="true" />
              Profil unit saja / belum membuka slot
            </p>
          </div>
          <DepartmentGrid departments={publicData.departments} source={publicData.source} />
        </section>
        <section className="inline-status-section section-pad">
          <div>
            <p className="eyebrow">Status periode</p>
            <h2>Profil unit bukan janji bahwa pendaftaran telah dibuka.</h2>
          </div>
          <RegistrationCta registration={publicData.registration} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
