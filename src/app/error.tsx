"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="route-error" id="main-content">
      <p className="eyebrow">Gangguan sementara</p>
      <h1>Halaman belum dapat ditampilkan.</h1>
      <p>Tidak ada data pendaftar yang ditampilkan. Silakan coba memuat halaman sekali lagi.</p>
      <button className="button button--primary" onClick={reset} type="button">
        Coba lagi
      </button>
    </main>
  );
}
