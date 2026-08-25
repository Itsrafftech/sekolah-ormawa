"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

export function DangerZone({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteCandidate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}/delete`, { method: "POST" });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Kandidat tidak dapat dihapus.");
        return;
      }
      router.push("/admin/dashboard/periode");
      router.refresh();
    } catch {
      setError("Kandidat tidak dapat dihapus. Periksa koneksi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-zone-title">
      <h3 id="danger-zone-title">Zona Super Admin</h3>
      {error ? <p className="account-manager__error" role="alert">{error}</p> : null}
      {confirming ? (
        <div className="danger-zone__confirm">
          <p>Hapus (soft-delete) kandidat ini? Data tetap ada di database dan dapat dipulihkan dari halaman Periode &amp; Override Lock.</p>
          <div>
            <button type="button" disabled={pending} onClick={() => void deleteCandidate()}>
              {pending ? <LoaderCircle aria-hidden="true" className="spin" size={14} /> : null} Ya, hapus kandidat
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)}>Batal</button>
          </div>
        </div>
      ) : (
        <button type="button" className="danger-zone__trigger" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" size={14} /> Hapus kandidat (soft delete)
        </button>
      )}
    </section>
  );
}
