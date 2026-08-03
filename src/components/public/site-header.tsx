"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/tentang", label: "Tentang" },
  { href: "/departemen", label: "Birdep" },
  { href: "/#alur", label: "Alur" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="Sekolah Ormawa - beranda">
          <span className="site-brand__mark" aria-hidden="true">
            <span>63</span>
          </span>
          <span className="site-brand__name">
            <strong>Sekolah Ormawa</strong>
            <small>Eksekutif PKU · DRAFT</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Navigasi utama">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="nav-cta" href="/#pendaftaran">
            Status pendaftaran
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </nav>

        <div className="mobile-nav">
          <button
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"}
            onClick={() => setMenuOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setMenuOpen((current) => !current);
              }
            }}
            type="button"
          >
            <Menu aria-hidden="true" size={22} />
            <span>Menu</span>
          </button>
          {menuOpen ? (
            <nav aria-label="Navigasi mobile" id="mobile-navigation">
              {navigation.map((item, index) => (
                <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                  <span aria-hidden="true">0{index + 1}</span>
                  {item.label}
                </Link>
              ))}
              <Link href="/#pendaftaran" onClick={() => setMenuOpen(false)}>
                Status pendaftaran
              </Link>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
