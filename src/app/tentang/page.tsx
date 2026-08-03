import type { Metadata } from "next";

import { PublicPageHero } from "@/components/public/public-page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { publicSiteContent } from "@/content/public-site";
import { createPublicMetadata } from "@/lib/public/metadata";

export const metadata: Metadata = createPublicMetadata({
  title: "Tentang Program",
  description:
    "Kenali definisi, tujuan, manfaat, serta hak dan kewajiban peserta Sekolah Ormawa.",
  path: "/tentang",
});

export default function AboutPage() {
  const { program } = publicSiteContent;

  return (
    <div className="public-site" id="top">
      <SiteHeader />
      <main id="main-content">
        <PublicPageHero
          draft
          description="Struktur informasi program sudah tersedia, sementara rincian durasi dan kebijakan pelaksanaan masih menunggu pengesahan pengurus."
          eyebrow="Mengenal program"
          index="01"
          title="Ruang belajar sebelum memilih jalan organisasi."
        />

        <section className="about-definition section-pad">
          <SectionHeading
            draft
            eyebrow="Definisi sementara"
            title="Sekolah Ormawa adalah pengalaman pengenalan dan magang organisasi."
          />
          <div className="editorial-callout">
            <p>{program.definition}</p>
            <aside>
              <strong>Durasi program</strong>
              <span>{program.duration}</span>
            </aside>
          </div>
        </section>

        <section className="about-lists section-pad">
          <InfoList index="02" items={program.goals} title="Tujuan" />
          <InfoList index="03" items={program.benefits} title="Manfaat" />
        </section>

        <section className="participant-contract section-pad">
          <SectionHeading
            draft
            eyebrow="Kontrak belajar"
            title="Hak dan kewajiban harus berjalan beriringan."
            description="Poin berikut adalah rancangan prinsip, bukan dokumen kebijakan final."
          />
          <div className="participant-contract__grid">
            <InfoList index="A" items={program.rights} title="Hak peserta" />
            <InfoList index="B" items={program.responsibilities} title="Kewajiban peserta" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoList({
  index,
  title,
  items,
}: {
  index: string;
  title: string;
  items: readonly string[];
}) {
  return (
    <article className="info-list">
      <header>
        <span>{index}</span>
        <h2>{title}</h2>
      </header>
      <ol>
        {items.map((item, itemIndex) => (
          <li key={item}>
            <span>{String(itemIndex + 1).padStart(2, "0")}</span>
            <p>{item}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
