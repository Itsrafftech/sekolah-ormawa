"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LoaderCircle, Unlock } from "lucide-react";

import type {
  CandidateLockSummary,
  CandidatePlacementSummary,
  PlacementStatusValue,
} from "@/features/candidates/contracts";

type LockPanelProps = {
  candidateId: string;
  departmentId: string;
  status: "SUBMITTED" | "LOCKED" | "WITHDRAWN" | "ARCHIVED";
  activeLock: CandidateLockSummary | null;
  placement: CandidatePlacementSummary | null;
};

const PLACEMENT_LABEL: Record<PlacementStatusValue, string> = {
  UNDER_REVIEW: "Sedang ditinjau",
  PLACED: "Ditempatkan",
  WAITLISTED: "Daftar tunggu",
  NOT_SELECTED: "Tidak dipilih",
  WITHDRAWN: "Mengundurkan diri",
};

function endpoint(candidateId: string, departmentId: string, path: "lock" | "placement") {
  return `/api/admin/candidates/${candidateId}/${path}?departmentId=${departmentId}`;
}

export function LockPanel({ candidateId, departmentId, status, activeLock, placement }: LockPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "lock" | "unlock">("idle");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placementPending, setPlacementPending] = useState(false);

  async function submitReason() {
    if (reason.trim().length < 5) {
      setError("Alasan minimal 5 karakter.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint(candidateId, departmentId, "lock"), {
        method: mode === "lock" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!response.ok && response.status !== 204) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Aksi tidak dapat diproses.");
        return;
      }
      setMode("idle");
      setReason("");
      router.refresh();
    } catch {
      setError("Aksi tidak dapat diproses. Periksa koneksi.");
    } finally {
      setPending(false);
    }
  }

  async function changePlacementStatus(next: PlacementStatusValue) {
    setPlacementPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint(candidateId, departmentId, "placement"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Status placement tidak dapat diperbarui.");
        return;
      }
      router.refresh();
    } catch {
      setError("Status placement tidak dapat diperbarui. Periksa koneksi.");
    } finally {
      setPlacementPending(false);
    }
  }

  if (status !== "SUBMITTED" && status !== "LOCKED") return null;

  return (
    <section className="lock-panel" aria-labelledby="lock-panel-title">
      <h3 id="lock-panel-title">{status === "LOCKED" ? "Terkunci" : "Kunci kandidat"}</h3>

      {status === "LOCKED" && activeLock ? (
        <div className="lock-panel__info">
          <p>Dikunci oleh <strong>{activeLock.lockedByName}</strong> pada {new Date(activeLock.lockedAt).toLocaleString("id-ID")}.</p>
          <p className="lock-panel__reason">&ldquo;{activeLock.lockReason}&rdquo;</p>
        </div>
      ) : (
        <p className="lock-panel__hint">Kandidat tersedia. Kunci untuk mengklaim dan mulai proses placement.</p>
      )}

      {status === "LOCKED" && placement ? (
        <div className="lock-panel__placement">
          <label htmlFor="placement-status">Status placement</label>
          <select
            id="placement-status"
            value={placement.status}
            disabled={placementPending}
            onChange={(event) => void changePlacementStatus(event.target.value as PlacementStatusValue)}
          >
            {(Object.keys(PLACEMENT_LABEL) as PlacementStatusValue[]).map((value) => (
              <option key={value} value={value}>{PLACEMENT_LABEL[value]}</option>
            ))}
          </select>
        </div>
      ) : null}

      {mode === "idle" ? (
        <button
          type="button"
          className="lock-panel__action"
          data-variant={status === "LOCKED" ? "unlock" : "lock"}
          onClick={() => setMode(status === "LOCKED" ? "unlock" : "lock")}
        >
          {status === "LOCKED" ? <Unlock aria-hidden="true" size={15} /> : <Lock aria-hidden="true" size={15} />}
          {status === "LOCKED" ? "Buka kunci" : "Kunci kandidat ini"}
        </button>
      ) : (
        <div className="lock-panel__form">
          <label htmlFor="lock-reason">
            {mode === "lock" ? "Alasan mengunci kandidat ini" : "Alasan membuka kunci"}
          </label>
          <textarea
            id="lock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Wajib diisi untuk jejak audit..."
          />
          <div className="lock-panel__form-actions">
            <button type="button" disabled={pending} onClick={() => void submitReason()}>
              {pending ? <LoaderCircle aria-hidden="true" className="spin" size={15} /> : null}
              {mode === "lock" ? "Konfirmasi kunci" : "Konfirmasi buka kunci"}
            </button>
            <button type="button" disabled={pending} onClick={() => { setMode("idle"); setReason(""); setError(null); }}>
              Batal
            </button>
          </div>
        </div>
      )}

      {error ? <p className="lock-panel__error" role="alert">{error}</p> : null}
    </section>
  );
}
