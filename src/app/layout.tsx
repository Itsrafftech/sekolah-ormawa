import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sekolah Ormawa Eksekutif PKU",
    template: "%s · Sekolah Ormawa",
  },
  description:
    "Fondasi aplikasi standalone Sekolah Ormawa Eksekutif PKU.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="id">
      <body>
        <a className="skip-link" href="#main-content">
          Lewati ke konten utama
        </a>
        {children}
      </body>
    </html>
  );
}
