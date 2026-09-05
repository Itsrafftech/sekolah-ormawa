"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, HelpCircle, Send, XCircle } from "lucide-react";

import type { CandidateSelectionDetail } from "@/features/candidates/contracts";
import { SelectionActionDialog, type SelectionChecklistItem } from "@/components/admin/selection-action-dialog";

type SelectionPanelProps = {
  candidateId: string;
  departmentId: string;
  selection: CandidateSelectionDetail;
};

type ActionKind = "take" | "hesitant" | "forward" | "eliminate";

const ENDPOINT: Record<ActionKind, string> = {
  take: "take",
  hesitant: "hesitant",
  forward: "forward",
  eliminate: "eliminate",
};

const STATUS_LABEL: Record<CandidateSelectionDetail["status"], string> = {
  PENDING: "Menunggu keputusan Pilihan 1",
  TAKEN: "Diambil Pilihan 1",
  HESITANT_P1: "Pilihan 1 ragu-ragu",
  FORWARDED: "Dialihkan ke Pilihan 2",
  TAKEN_P2: "Diambil Pilihan 2",
  HESITANT_P2: "Pilihan 2 ragu-ragu",
  ELIMINATED: "Digugurkan",
};

export function SelectionPanel({ candidateId, departmentId, selection }: SelectionPanelProps) {
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<ActionKind | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = selection.role;
  // P1 may act while the decision is still theirs to make (PENDING /
  // HESITANT_P1); P2 may act only once forwarded (FORWARDED) - see
  // src/server/candidates/selection.ts PJ_ACTION_RULES for the
  // server-side source of truth this mirrors (this is just UI affordance,
  // every action is re-validated server-side regardless).
  const p1CanAct = role === "P1" && (selection.status === "PENDING" || selection.status === "HESITANT_P1");
  const p2CanAct = role === "P2" && selection.status === "FORWARDED";
  const canAct = p1CanAct || p2CanAct;

  async function submit(action: ActionKind, reason: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/candidates/${candidateId}/selection/${ENDPOINT[action]}?departmentId=${departmentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || undefined }),
        },
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Aksi tidak dapat diproses.");
        return;
      }
      setDialogAction(null);
      router.refresh();
    } catch {
      setError("Aksi tidak dapat diproses. Periksa koneksi.");
    } finally {
      setPending(false);
    }
  }

  const dialogConfig: Record<ActionKind, { title: string; confirmLabel: string; checklist: SelectionChecklistItem[] }> = {
    take: {
      title: "Ambil kandidat ini?",
      confirmLabel: "Ya, ambil kandidat",
      checklist: [
        { id: "reviewed", label: "Saya sudah meninjau data dan dokumen kandidat ini." },
        { id: "final", label: "Saya paham keputusan ini eksklusif - kandidat akan hilang dari dashboard Birdep lain." },
      ],
    },
    hesitant: {
      title: "Tandai ragu-ragu?",
      confirmLabel: "Ya, tandai ragu-ragu",
      checklist: [
        { id: "confirm", label: "Saya belum siap mengambil keputusan final untuk kandidat ini." },
      ],
    },
    forward: {
      title: "Alihkan ke Pilihan 2?",
      confirmLabel: "Ya, alihkan ke Pilihan 2",
      checklist: [
        { id: "reviewed", label: "Saya sudah meninjau data kandidat dan memutuskan tidak mengambilnya." },
        { id: "notify", label: "Saya paham PJ Birdep Pilihan 2 akan menerima notifikasi email dan dapat mengambil alih." },
      ],
    },
    eliminate: {
      title: "Gugurkan kandidat ini?",
      confirmLabel: "Ya, gugurkan kandidat",
      checklist: [
        { id: "reviewed", label: "Saya sudah meninjau data kandidat ini sebagai Pilihan 2." },
        { id: "final", label: "Saya paham tindakan ini menghapus (soft-delete) kandidat dari seluruh sistem dan hanya dapat dipulihkan Super Admin." },
      ],
    },
  };

  return (
    <section className="selection-panel" aria-labelledby="selection-panel-title">
      <h3 id="selection-panel-title">Keputusan Seleksi</h3>

      <div className="selection-panel__status">
        <span className={`selection-panel__badge selection-panel__badge--${selection.status.toLowerCase()}`}>
          {STATUS_LABEL[selection.status]}
        </span>
        <p className="selection-panel__hint">
          Pilihan 1: <strong>{selection.primaryDeptName}</strong> &middot; Pilihan 2: <strong>{selection.secondaryDeptName}</strong>
        </p>
        {role === "P1" && selection.status === "HESITANT_P2" ? (
          <p className="selection-panel__notice selection-panel__notice--warning">
            PJ Pilihan 2 juga menandai ragu-ragu untuk kandidat ini.
          </p>
        ) : null}
        {selection.p1Reason ? <p className="selection-panel__reason">Alasan Pilihan 1: &ldquo;{selection.p1Reason}&rdquo;</p> : null}
        {selection.p2Reason ? <p className="selection-panel__reason">Alasan Pilihan 2: &ldquo;{selection.p2Reason}&rdquo;</p> : null}
      </div>

      {canAct ? (
        <div className="selection-panel__actions">
          <button type="button" onClick={() => setDialogAction("take")}>
            <CheckCircle2 aria-hidden="true" size={15} /> Ambil
          </button>
          <button type="button" onClick={() => setDialogAction("hesitant")}>
            <HelpCircle aria-hidden="true" size={15} /> Ragu-ragu
          </button>
          {p1CanAct ? (
            <button type="button" onClick={() => setDialogAction("forward")}>
              <Send aria-hidden="true" size={15} /> Alihkan ke Pilihan 2
            </button>
          ) : null}
          {p2CanAct ? (
            <button type="button" className="selection-panel__action--danger" onClick={() => setDialogAction("eliminate")}>
              <XCircle aria-hidden="true" size={15} /> Gugurkan
            </button>
          ) : null}
        </div>
      ) : null}

      {error && !dialogAction ? <p className="selection-panel__error" role="alert">{error}</p> : null}

      {dialogAction ? (
        <SelectionActionDialog
          open={dialogAction !== null}
          title={dialogConfig[dialogAction].title}
          checklist={dialogConfig[dialogAction].checklist}
          confirmLabel={dialogConfig[dialogAction].confirmLabel}
          pending={pending}
          error={error}
          onConfirm={(reason) => void submit(dialogAction, reason)}
          onClose={() => { setDialogAction(null); setError(null); }}
        />
      ) : null}
    </section>
  );
}
