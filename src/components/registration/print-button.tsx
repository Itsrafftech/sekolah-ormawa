"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="button button--primary" onClick={() => window.print()} type="button">
      <Printer aria-hidden="true" size={17} /> Cetak / simpan PDF
    </button>
  );
}
