import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { publicSiteContent } from "@/content/public-site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__marquee" aria-hidden="true">
        <span>Kenal · Belajar · Berkontribusi · Angkatan 63 · </span>
        <span>Kenal · Belajar · Berkontribusi · Angkatan 63 · </span>
      </div>
      <div className="site-footer__inner">
        <div className="site-footer__lead">
          <span className="site-footer__index">SO / 63</span>
          <h2>Ruang pertama untuk membaca organisasi dari dekat.</h2>
          <p>{publicSiteContent.previewNotice}</p>
        </div>
        <div className="site-footer__columns">
          <div>
            <h3>Navigasi</h3>
            <Link href="/tentang">Tentang program</Link>
            <Link href="/departemen">Direktori Birdep</Link>
            <Link href="/faq">Pertanyaan umum</Link>
            <Link href="/kebijakan-privasi">Kebijakan privasi</Link>
          </div>
          <div>
            <h3>Hubungi</h3>
            <p>{publicSiteContent.footer.contact}</p>
            <p>{publicSiteContent.footer.social}</p>
          </div>
          <div>
            <h3>Internal</h3>
            <span className="footer-disabled-link" aria-disabled="true">
              Login admin
              <small>Tersedia pada Phase 4</small>
            </span>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© 2026 {publicSiteContent.footer.organization}</p>
        <a href="#top">
          Kembali ke atas <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      </div>
    </footer>
  );
}
