"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

const navigation = [
  { href: "/#tentang-program", label: "Tentang" },
  { href: "/#birdep", label: "Birdep" },
  { href: "/#alur", label: "Alur" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Previously the only way to close the mobile menu once opened was to
  // hit the exact same hamburger button again (whose icon never changed,
  // so it gave no visual cue that a second tap would close it rather than
  // do nothing/reopen it) - tapping anywhere else on the page, or Escape,
  // did nothing.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // handleMobileNavigate closes the menu first, then smooth-scrolls to the
  // target. The delay lets the collapse animation finish before the viewport
  // moves, so the two motions don't fight each other (same pattern as the
  // reference one-scroll site). hrefs here are /#hash form, so grab the hash.
  function handleMobileNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    setMenuOpen(false);
    const hash = href.split("#")[1];
    setTimeout(() => {
      document.querySelector(`#${hash}`)?.scrollIntoView({ behavior: "smooth" });
    }, 350);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="Sekolah Ormawa - beranda">
          <Image
            alt=""
            className="site-brand__mark"
            height={417}
            priority
            src="/images/logo_logo.png"
            width={525}
          />
          <span className="site-brand__name">
            <strong>Sekolah Ormawa</strong>
            <small>Ormawa PKU</small>
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

        <div className="mobile-nav" ref={navRef}>
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
            ref={toggleRef}
            type="button"
          >
            {menuOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
            <span>Menu</span>
          </button>
          {menuOpen ? (
            <nav aria-label="Navigasi mobile" id="mobile-navigation">
              {navigation.map((item, index) => (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={(event) => handleMobileNavigate(event, item.href)}
                >
                  <span aria-hidden="true">0{index + 1}</span>
                  {item.label}
                </Link>
              ))}
              <Link
                href="/#pendaftaran"
                onClick={(event) => handleMobileNavigate(event, "/#pendaftaran")}
              >
                Status pendaftaran
              </Link>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
