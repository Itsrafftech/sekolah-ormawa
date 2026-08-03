import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Area Internal",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-auth-shell">
      <header className="admin-auth-header">
        <Link className="admin-auth-brand" href="/" aria-label="Kembali ke Sekolah Ormawa">
          <span>63</span>
          <span><strong>Sekolah Ormawa</strong><small>Ruang internal · DRAFT</small></span>
        </Link>
        <div className="admin-auth-security"><ShieldCheck aria-hidden="true" size={17} /> Autentikasi internal</div>
      </header>
      {children}
      <footer className="admin-auth-footer">
        <span>Sekolah Ormawa · Eksekutif PKU</span>
        <span>Session dan authorization divalidasi server.</span>
      </footer>
    </div>
  );
}

