import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldAlert } from "lucide-react";

import { PrintButton } from "@/components/registration/print-button";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { publicSiteContent } from "@/content/public-site";
import { createPublicMetadata } from "@/lib/public/metadata";
import { getRegistrationConfirmation } from "@/server/registration/submit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...createPublicMetadata({
    title: "Bukti Pendaftaran",
    description: "Konfirmasi pendaftaran Sekolah Ormawa.",
    path: "/daftar/sukses",
  }),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const confirmation = await getRegistrationConfirmation(token);

  return (
    <div className="public-site registration-site">
      <SiteHeader />
      <main className="confirmation-main" id="main-content">
        {confirmation ? (
          <article className="confirmation-card">
            <div className="confirmation-card__seal" aria-hidden="true">
              <Check size={38} strokeWidth={1.4} />
            </div>
            <p className="eyebrow">Pendaftaran tersimpan</p>
            <h1>Simpan bukti ini dengan baik.</h1>
            <p className="confirmation-card__lead">
              Data telah committed. Kegagalan email development tidak membatalkan pendaftaran.
            </p>
            <dl className="confirmation-record">
              <div><dt>Nomor registrasi</dt><dd>{confirmation.candidate.registrationNumber}</dd></div>
              <div><dt>Nama peserta</dt><dd>{confirmation.candidate.name}</dd></div>
              <div>
                <dt>Waktu submit</dt>
                <dd>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(confirmation.candidate.submittedAt)}</dd>
              </div>
              <div>
                <dt>Pilihan Birdep</dt>
                <dd>{confirmation.candidate.choices.map((choice) => choice.department.name).join(" / ")}</dd>
              </div>
            </dl>
            <div className="confirmation-next">
              <div>
                <strong>Informasi tahap berikutnya menyusul.</strong>
                <p>Sambil menunggu jadwal resmi, gabung ke grup WhatsApp peserta agar tidak ketinggalan kabar.</p>
                <a
                  className="button button--primary no-print"
                  href={publicSiteContent.contact.whatsappGroupUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {publicSiteContent.contact.whatsappGroupLabel}
                  <ArrowUpRight aria-hidden="true" size={16} />
                </a>
              </div>
            </div>
            <div className="confirmation-actions no-print">
              <PrintButton />
              <Link className="button button--outline" href="/">Kembali ke beranda</Link>
            </div>
          </article>
        ) : (
          <section className="confirmation-invalid">
            <ShieldAlert aria-hidden="true" size={44} strokeWidth={1.3} />
            <p className="eyebrow">Tautan tidak berlaku</p>
            <h1>Bukti pendaftaran tidak dapat dibuka.</h1>
            <p>Token tidak valid atau telah kedaluwarsa. Data tidak pernah dicari menggunakan ID kandidat maupun nomor registrasi saja.</p>
            <Link className="button button--outline" href="/">Kembali ke beranda</Link>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
