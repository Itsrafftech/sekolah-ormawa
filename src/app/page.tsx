import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowDown,
  Compass,
  HandHeart,
  Sparkles,
} from "lucide-react";

import { DepartmentGrid } from "@/components/public/department-grid";
import { RegistrationCta } from "@/components/public/registration-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { publicSiteContent } from "@/content/public-site";
import { createPublicMetadata } from "@/lib/public/metadata";
import { getPublicLandingData } from "@/lib/public/recruitment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPublicMetadata({
  title: "Sekolah Ormawa PKU",
  description:
    "Program magang dan pengenalan organisasi untuk mahasiswa baru IPB Angkatan 63.",
  path: "/",
});

const programHighlights = [
  {
    icon: Compass,
    label: "Kenali",
    copy: "Memahami lingkungan, struktur, dan peran organisasi mahasiswa di PKU IPB.",
  },
  {
    icon: Sparkles,
    label: "Pelajari",
    copy: "Mendapatkan bekal dasar kepemimpinan, kesekretariatan, kebendaharaan, pembuatan acara, dan struktur kepanitiaan.",
  },
  {
    icon: HandHeart,
    label: "Berperan",
    copy: "Mengikuti pengalaman magang dan mengerjakan project sesuai Biro, Departemen, Komisi, atau Badan penempatan.",
  },
] as const;

export default async function HomePage() {
  const publicData = await getPublicLandingData();

  // Real, server-derived structure - never invented copy. The public data
  // layer already excludes BPH (it coordinates the executive branch but
  // never accepts applicants), so these two counts are a true partition of
  // publicData.departments - they always sum back to totalUnits, by
  // construction, instead of only lining up for today's fixture data.
  const totalUnits = publicData.departments.length;
  const executiveUnits = publicData.departments.filter(
    (department) => department.track === "EXECUTIVE",
  ).length;
  const legislativeUnits = publicData.departments.filter(
    (department) => department.track === "LEGISLATIVE",
  ).length;

  return (
    <div className="public-site" id="top">
      <SiteHeader />

      <main id="main-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <div className="hero-meta">
              <span>{publicSiteContent.hero.eyebrow}</span>
              <span>IPB 63</span>
            </div>
            <h1 id="home-title">
              Kenali <mark className="hl">organisasi</mark>.
              <span> Temukan peran.</span>
              <em> Bertumbuh bersama.</em>
            </h1>
            <p>{publicSiteContent.hero.description}</p>
            <div className="home-hero__actions">
              <RegistrationCta registration={publicData.registration} compact />
            </div>
          </div>

          <div className="hero-portal" aria-label="Identitas Angkatan 63">
            <div className="hero-portal__orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="hero-portal__center">
              <small>Angkatan</small>
              <strong>63</strong>
              <span>IPB</span>
            </div>
            <p>Masuk untuk mengenal. Keluar dengan arah.</p>
            <div className="hero-portal__badge">
              <Image alt="Sekolah Ormawa" height={590} src="/images/logo_tulisan.png" width={2216} />
            </div>
          </div>

          <a className="scroll-cue" href="#tentang-program">
            <ArrowDown aria-hidden="true" size={16} />
            Jelajahi
          </a>
        </section>

        <section className="organization-intro section-pad" id="tentang-program">
          <div className="organization-intro__head">
            <span className="section-index">01 / ORGANISASI</span>
            <h2>{publicSiteContent.organization.title}</h2>
          </div>

          <div className="organization-intro__body">
            <div className="organization-structure">
              <p className="organization-structure__caption">Struktur unit kerja</p>

              {totalUnits > 0 ? (
                <>
                  <div className="organization-structure__total">
                    <strong>{totalUnits}</strong>
                    <span>Unit kerja aktif di Ormawa PKU</span>
                  </div>

                  <div className="organization-structure__branches">
                    <div className="organization-structure__branch">
                      <strong>{executiveUnits}</strong>
                      <span>Eksekutif</span>
                    </div>
                    <div className="organization-structure__branch">
                      <strong>{legislativeUnits}</strong>
                      <span>Legislatif</span>
                    </div>
                  </div>

                  {/* executiveUnits + legislativeUnits always equals
                      totalUnits above - see the partition comment where
                      these are computed - so the breakdown never visually
                      disagrees with the total. */}
                  <div className="organization-structure__bar" role="presentation">
                    <span
                      className="organization-structure__bar-segment organization-structure__bar-segment--executive"
                      style={{ flexGrow: executiveUnits || 1 }}
                    />
                    <span
                      className="organization-structure__bar-segment organization-structure__bar-segment--legislative"
                      style={{ flexGrow: legislativeUnits || 1 }}
                    />
                  </div>
                </>
              ) : (
                <p className="organization-structure__footnote">
                  Data unit kerja sedang tidak tersedia.
                </p>
              )}
            </div>

            <div className="organization-intro__notes">
              <p className="organization-intro__lead">{publicSiteContent.organization.description}</p>
              <p className="organization-intro__annotation">{publicSiteContent.organization.note}</p>
            </div>
          </div>
        </section>

        <section className="program-manifesto section-pad">
          <div className="program-manifesto__lead">
            <span className="section-index">02 / PROGRAM</span>
            <blockquote>
              Kenali organisasi. Pelajari cara kerjanya.
              <em> Temukan peranmu.</em>
            </blockquote>
          </div>
          <div className="program-highlights">
            {programHighlights.map(({ icon: Icon, label, copy }) => (
              <article key={label}>
                <Icon aria-hidden="true" size={22} strokeWidth={1.6} />
                <h3>{label}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="impact-band" aria-labelledby="impact-title">
          <div className="impact-band__inner">
            <div className="impact-band__lead">
              <span className="section-index">03 / KOMITMEN</span>
              <h2 id="impact-title">
                Bekal untuk mengambil <mark className="hl">peran</mark>.
              </h2>
            </div>
            <div className="impact-band__stats">
              <article>
                <strong>{publicData.departments.length || 18}</strong>
                <span>Unit kerja PKU yang bisa dikenali langsung, dari struktur hingga peran kerjanya.</span>
              </article>
              <article>
                <strong>63</strong>
                <span>Angkatan IPB yang diajak menemukan potensi dan minat sebelum mengambil peran.</span>
              </article>
              <article>
                <strong>3</strong>
                <span>Tahapan magang yang melatih kerja sama, komunikasi, dan pengambilan keputusan: Kenali, Pelajari, Berperan.</span>
              </article>
            </div>
          </div>
        </section>

        <section className="directory-section section-pad" id="birdep">
          <SectionHeading
            eyebrow="Direktori unit"
            title="Banyak ruang, satu kesempatan untuk mengenali arah."
            description="Kartu berikut bersumber langsung dari data organisasi. Profil unit tidak otomatis berarti unit tersebut membuka slot pada periode aktif."
          />
          <DepartmentGrid
            departments={publicData.departments}
            limit={6}
            source={publicData.source}
          />
        </section>

        <section className="experience-section section-pad">
          <SectionHeading
            eyebrow="Rancangan pengalaman"
            title="Tiga gerak belajar yang membentuk perjalanan."
            description="Ini bukan daftar program kerja resmi. Bentuk kegiatan final akan mengikuti rancangan unit dan periode yang telah disahkan."
          />
          <div className="experience-list">
            {publicSiteContent.experiences.map((experience) => (
              <article key={experience.number}>
                <span>{experience.number}</span>
                <h3>{experience.title}</h3>
                <p>{experience.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="timeline-section section-pad" id="alur">
          <SectionHeading
            eyebrow="Alur program"
            title="Linimasa Sekolah Ormawa 2026."
            description="Rangkaian kegiatan dari pendaftaran hingga penutupan, sesuai jadwal resmi Sekolah Ormawa 2026."
          />
          <div className="timeline-columns">
            <TimelineColumn
              items={publicSiteContent.selectionTimeline}
              kicker="Lintasan A"
              title="Seleksi & pembukaan"
            />
            <TimelineColumn
              items={publicSiteContent.internshipTimeline}
              kicker="Lintasan B"
              title="Kelas & penutupan"
            />
          </div>
        </section>

        <section className="faq-preview section-pad" id="faq">
          <SectionHeading
            eyebrow="Pertanyaan umum"
            title="Sebelum melangkah, pastikan informasinya jelas."
          />
          <div className="faq-list">
            {publicSiteContent.faq.slice(0, 4).map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.question}
                  <span className="faq-toggle" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing-cta section-pad">
          <div className="closing-cta__copy">
            <p className="eyebrow">Langkah berikutnya</p>
            <h2>
              Daftar Sekolah <mark className="hl">Ormawa</mark> 2026.
            </h2>
            <p>
              Tombol di samping selalu mengikuti status pendaftaran yang berlaku saat ini.
            </p>
          </div>
          <RegistrationCta registration={publicData.registration} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function TimelineColumn({
  kicker,
  title,
  items,
}: {
  kicker: string;
  title: string;
  items: readonly { step: string; detail: string }[];
}) {
  return (
    <section className="timeline-column">
      <p>{kicker}</p>
      <h3>{title}</h3>
      <ol>
        {items.map((item, index) => (
          <li key={item.step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{item.step}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
