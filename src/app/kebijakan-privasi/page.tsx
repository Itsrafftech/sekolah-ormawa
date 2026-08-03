import type { Metadata } from "next";

import { PublicPageHero } from "@/components/public/public-page-hero";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { createPublicMetadata } from "@/lib/public/metadata";

export const metadata: Metadata = createPublicMetadata({
  title: "Kebijakan Privasi - DRAFT",
  description:
    "Struktur awal kebijakan privasi Sekolah Ormawa yang belum menjadi kebijakan hukum final.",
  path: "/kebijakan-privasi",
});

const privacySections = [
  {
    title: "Data yang diproses",
    body: "Kategori data pendaftaran, dokumen, dan metadata keamanan akan dirinci setelah formulir serta dasar pemrosesan disetujui.",
  },
  {
    title: "Tujuan penggunaan",
    body: "Tujuan pemrosesan akan dibatasi pada administrasi program, seleksi, komunikasi, dan kebutuhan keamanan yang telah disetujui.",
  },
  {
    title: "Akses dan pembagian",
    body: "Rancangan sistem membatasi akses berdasarkan role dan scope Birdep. Daftar penerima data serta prosedur permintaan akses belum final.",
  },
  {
    title: "Penyimpanan dan retensi",
    body: "CV, pas foto, KTM, dan portofolio dirancang berada di private storage. Durasi retensi dan prosedur penghapusan belum diputuskan.",
  },
  {
    title: "Hak peserta",
    body: "Mekanisme koreksi, akses, penarikan consent, dan penghapusan akan ditulis setelah kebijakan resmi disahkan.",
  },
  {
    title: "Kontak pengelola data",
    body: "Identitas dan kanal resmi penanggung jawab data masih menunggu penetapan pengurus.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="public-site" id="top">
      <SiteHeader />
      <main id="main-content">
        <PublicPageHero
          draft
          description="Halaman ini baru menyediakan struktur konfigurasi. Isinya bukan nasihat hukum atau kebijakan final dan tidak boleh dianggap sebagai consent resmi."
          eyebrow="Transparansi data"
          index="04"
          title="Kebijakan privasi yang belum final harus terlihat belum final."
        />
        <section className="privacy-page section-pad">
          <div className="privacy-alert" role="note">
            <strong>DRAFT - belum berlaku sebagai kebijakan resmi</strong>
            <p>
              Dasar pemrosesan, versi consent, masa retensi, owner data, dan kanal hak subjek data masih memerlukan keputusan pengurus.
            </p>
          </div>
          <div className="privacy-grid">
            {privacySections.map((section, index) => (
              <article key={section.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
