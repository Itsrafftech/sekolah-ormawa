"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import type { SelectionStatusValue } from "@/features/candidates/selection-contracts";
import { SelectionActionDialog } from "@/components/admin/selection-action-dialog";

type SelectionAdminPanelProps = {
  candidateId: string;
  status: SelectionStatusValue;
};

/**
 * Super Admin authority to pull back any decision to PENDING - separate
 * from the ELIMINATED-restore action, which lives in the cross-department
 * "Kandidat Terhapus" list (override-lock-panel.tsx) since an eliminated
 * candidate is soft-deleted and can't be reached via this detail page at
 * all (findScopedCandidateId filters deletedAt:null for every role).
 */
export function SelectionAdminPanel({ candidateId, status }: SelectionAdminPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "PENDING") return null;

  async function submit(reason: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}/selection/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Reset tidak dapat diproses.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Reset tidak dapat diproses. Periksa koneksi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="selection-admin-panel" aria-labelledby="selection-admin-panel-title">
      <h3 id="selection-admin-panel-title">Kewenangan Super Admin</h3>
      <p className="selection-admin-panel__hint">
        Tarik kembali keputusan seleksi kandidat ini ke status awal (Menunggu Pilihan 1). Wajib alasan, tercatat audit log.
      </p>
      <button type="button" className="selection-admin-panel__trigger" onClick={() => setOpen(true)}>
        <RotateCcw aria-hidden="true" size={14} /> Reset ke Pending
      </button>
      {error && !open ? <p className="selection-admin-panel__error" role="alert">{error}</p> : null}

      <SelectionActionDialog
        open={open}
        title="Reset keputusan seleksi ke Pending?"
        description="Semua field keputusan Pilihan 1 dan Pilihan 2 (status, alasan, waktu) akan dikosongkan."
        checklist={[
          { id: "confirm", label: "Saya memahami tindakan ini membatalkan keputusan yang sudah diambil PJ terkait." },
        ]}
        confirmLabel="Ya, reset ke Pending"
        requireReason
        reasonLabel="Alasan reset (wajib)"
        pending={pending}
        error={error}
        onConfirm={(reason) => void submit(reason)}
        onClose={() => { setOpen(false); setError(null); }}
      />
    </section>
  );
}
