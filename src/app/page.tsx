import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenText,
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
  title: "Sekolah Ormawa Eksekutif PKU",
  description:
    "Program magang dan pengenalan organisasi untuk mahasiswa baru IPB Angkatan 63.",
  path: "/",
});

const programHighlights = [
  {
    icon: Compass,
    label: "Kenal",
    copy: "Membaca karakter dan cara kerja unit organisasi.",
  },
  {
    icon: Sparkles,
    label: "Coba",
    copy: "Mengambil bagian dalam pengalaman belajar yang terarah.",
  },
  {
    icon: HandHeart,
    label: "Tumbuh",
    copy: "Menerima umpan balik dan merumuskan langkah berikutnya.",
  },
] as const;

export default async function HomePage() {
  const publicData = await getPublicLandingData();

  return (
    <div className="public-site" id="top">
      <div className="preview-ribbon" role="status">
        <span>DRAFT</span>
        <p>{publicSiteContent.previewNotice}</p>
      </div>
      <SiteHeader />

      <main id="main-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <div className="hero-meta">
              <span>{publicSiteContent.hero.eyebrow}</span>
              <span aria-hidden="true">/</span>
              <span>IPB 63</span>
            </div>
            <h1 id="home-title">
              Belajar organisasi
              <span> dari dalam,</span>
              <em> bertumbuh bersama.</em>
            </h1>
            <p>{publicSiteContent.hero.description}</p>
            <div className="home-hero__actions">
              <RegistrationCta registration={publicData.registration} compact />
              <Link className="text-link" href="/tentang">
                Kenali program <ArrowRight aria-hidden="true" size={16} />
              </Link>
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
          </div>

          <a className="scroll-cue" href="#tentang-program">
            <ArrowDown aria-hidden="true" size={16} />
            Jelajahi
          </a>
        </section>

        <section className="organization-intro section-pad" id="tentang-program">
          <SectionHeading
            draft
            eyebrow={publicSiteContent.organization.eyebrow}
            title={publicSiteContent.organization.title}
            description={publicSiteContent.organization.description}
          />
          <div className="organization-intro__body">
            <div className="organization-monogram" aria-hidden="true">
              <span>O</span>
              <span>E</span>
              <span>PKU</span>
            </div>
            <div className="organization-intro__notes">
              <p>{publicSiteContent.organization.note}</p>
              <Link href="/tentang">
                Baca konteks program <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="program-manifesto section-pad">
          <div className="program-manifesto__lead">
            <span className="section-index">02 / PROGRAM</span>
            <blockquote>
              Bukan sekadar melihat organisasi bekerja. Ini ruang untuk
              <em> mencoba, bertanya, dan membaca diri.</em>
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

        <section className="directory-section section-pad" id="birdep">
          <SectionHeading
            draft
            eyebrow="Direktori unit"
            title="Banyak ruang, satu kesempatan untuk mengenali arah."
            description="Kartu berikut bersumber dari master data PostgreSQL. Profil unit tidak otomatis berarti unit tersebut membuka slot pada periode aktif."
          />
          <DepartmentGrid
            departments={publicData.departments}
            limit={6}
            source={publicData.source}
          />
          <div className="section-link-row">
            <span>{publicData.departments.length} profil unit tersedia</span>
            <Link className="button button--outline" href="/departemen">
              Lihat semua Birdep <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </section>

        <section className="experience-section section-pad">
          <SectionHeading
            draft
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

        <section className="gallery-section section-pad" id="galeri">
          <SectionHeading
            draft
            eyebrow="Galeri kegiatan"
            title="Tempat untuk cerita yang akan datang."
            description="Visual abstrak lokal digunakan sementara agar tidak mengarang dokumentasi atau memakai aset tanpa izin."
          />
          <div className="abstract-gallery">
            {publicSiteContent.gallery.map((item, index) => (
              <figure className={`gallery-card gallery-card--${item.variant}`} key={item.label}>
                <div className="gallery-card__visual" aria-label={item.caption} role="img">
                  <span className="gallery-card__number">0{index + 1}</span>
                  <span className="shape shape--one" />
                  <span className="shape shape--two" />
                  <span className="shape shape--three" />
                </div>
                <figcaption>
                  <strong>{item.label}</strong>
                  <span>{item.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="testimonial-section section-pad">
          <SectionHeading
            draft
            eyebrow="Suara dari perjalanan"
            title="Tidak ada kutipan rekaan di sini."
            description="Bagian testimoni disiapkan sebagai struktur, lalu hanya akan diisi setelah narasumber dan persetujuan publikasi terverifikasi."
          />
          <div className="testimonial-grid">
            {publicSiteContent.testimonials.map((testimonial, index) => (
              <article key={testimonial}>
                <BookOpenText aria-hidden="true" size={24} strokeWidth={1.5} />
                <span>Placeholder 0{index + 1}</span>
                <p>{testimonial}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="timeline-section section-pad" id="alur">
          <SectionHeading
            draft
            eyebrow="Alur program"
            title="Dua lintasan, tanpa tanggal yang dikarang."
            description="Tahapan berikut adalah kerangka informasi. Jadwal dan mekanisme resmi belum dikonfirmasi."
          />
          <div className="timeline-columns">
            <TimelineColumn
              items={publicSiteContent.selectionTimeline}
              kicker="Lintasan A"
              title="Seleksi"
            />
            <TimelineColumn
              items={publicSiteContent.internshipTimeline}
              kicker="Lintasan B"
              title="Pelaksanaan magang"
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
          <Link className="text-link faq-more" href="/faq">
            Lihat semua pertanyaan <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>

        <section className="closing-cta section-pad">
          <div className="closing-cta__copy">
            <p className="eyebrow">Langkah berikutnya</p>
            <h2>Siap mengenal organisasi dari jarak yang lebih dekat?</h2>
            <p>
              Tombol mengikuti status periode dan gate rilis dari server. Data DRAFT tidak pernah membuka form.
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
