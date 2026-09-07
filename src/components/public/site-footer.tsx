import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { publicSiteContent } from "@/content/public-site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__lead">
          <span className="site-footer__index">SO / 63</span>
          <h2>Ruang pertama untuk membaca organisasi dari dekat.</h2>
        </div>
        <div className="site-footer__columns">
          <div>
            <h3>Navigasi</h3>
            <Link href="/#tentang-program">Tentang program</Link>
            <Link href="/#birdep">Direktori Birdep</Link>
            <Link href="/#faq">Pertanyaan umum</Link>
            <Link href="/kebijakan-privasi">Kebijakan privasi</Link>
          </div>
          <div>
            <h3>Ormawa PKU</h3>
            <a href="https://ormawaeksekutifpku.com" rel="noopener noreferrer" target="_blank">
              Ormawa Eksekutif PKU
            </a>
            <a href="https://legislatifpku.com" rel="noopener noreferrer" target="_blank">
              Ormawa Legislatif PKU
            </a>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div>
          <p>© 2026 {publicSiteContent.footer.organization}</p>
          <p className="site-footer__credit">{publicSiteContent.footer.credit}</p>
        </div>
        <a href="#top">
          Kembali ke atas <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      </div>
    </footer>
  );
}
