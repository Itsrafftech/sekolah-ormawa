import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldAlert } from "lucide-react";

import { PrintButton } from "@/components/registration/print-button";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { publicSiteContent } from "@/content/public-site";
import { createPublicMetadata } from "@/lib/public/metadata";
import { getRegistrationConfirmation } from "@/server/registration/submit";

export const dynamic = "force-dynamic";

// "Tambahan Halaman Sukses": lucide-react tidak menyediakan glyph brand
// WhatsApp - ikon resmi disematkan inline (bukan menambah dependency baru)
// agar tombol tetap dikenali sebagai WhatsApp, bukan ikon chat generik.
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.892.526 3.66 1.438 5.166L2 22l4.958-1.4A9.955 9.955 0 0 0 12.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2m0 18.166a8.14 8.14 0 0 1-4.153-1.14l-.298-.177-3.09.873.85-3.115-.194-.32a8.14 8.14 0 0 1-1.245-4.287c0-4.494 3.656-8.15 8.15-8.15 4.493 0 8.149 3.656 8.149 8.15 0 4.493-3.656 8.166-8.169 8.166" />
    </svg>
  );
}

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
            {/* "Tambahan Halaman Sukses": section wajib di bawah nomor
                registrasi - hanya perubahan UI, tidak ada perubahan
                database/API (whatsappGroupUrl sudah ada di
                publicSiteContent sebelumnya). */}
            <div className="confirmation-next">
              <div>
                <h2>Bergabung ke Grup WhatsApp Peserta</h2>
                <p>
                  Klik tombol di bawah untuk bergabung ke grup WhatsApp komunitas pendaftar Sekolah Ormawa. Di sini
                  kamu akan mendapatkan informasi terbaru seputar seleksi dan program.
                </p>
                <a
                  className="button button--whatsapp no-print"
                  href={publicSiteContent.contact.whatsappGroupUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon />
                  {publicSiteContent.contact.whatsappGroupLabel}
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
