import type { Metadata } from "next";

import { PublicPageHero } from "@/components/public/public-page-hero";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { publicSiteContent } from "@/content/public-site";
import { createPublicMetadata } from "@/lib/public/metadata";

export const metadata: Metadata = createPublicMetadata({
  title: "Pertanyaan Umum",
  description: "Pertanyaan umum tentang Sekolah Ormawa dan status informasi program.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="public-site" id="top">
      <SiteHeader />
      <main id="main-content">
        <PublicPageHero
          description="Jawaban membedakan keputusan yang sudah berlaku dari detail yang belum final. Tidak ada tanggal, kuota, atau kebijakan yang dikarang."
          eyebrow="Pusat informasi"
          index="03"
          title="Pertanyaan yang layak dijawab dengan jujur."
        />
        <section className="faq-page section-pad">
          <div className="faq-list faq-list--large">
            {publicSiteContent.faq.map((item, index) => (
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
      </main>
      <SiteFooter />
    </div>
  );
}
