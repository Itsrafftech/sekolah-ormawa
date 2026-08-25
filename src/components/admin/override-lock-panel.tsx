"use client";

import { useState } from "react";
import { LoaderCircle, RotateCcw, Unlock } from "lucide-react";

import type {
  DeletedCandidateItem,
  LockedCandidateItem,
} from "@/features/admin/candidate-admin-contracts";

type OverrideLockPanelProps = {
  initialLocks: LockedCandidateItem[];
  initialDeleted: DeletedCandidateItem[];
};

export function OverrideLockPanel({ initialLocks, initialDeleted }: OverrideLockPanelProps) {
  const [locks, setLocks] = useState(initialLocks);
  const [deleted, setDeleted] = useState(initialDeleted);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function override(candidateId: string) {
    const reason = (reasonDraft[candidateId] ?? "").trim();
    if (reason.length < 5) {
      setError("Alasan override minimal 5 karakter.");
      return;
    }
    setPending(candidateId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(result?.error?.message ?? "Override tidak dapat diproses.");
        return;
      }
      setLocks((previous) => previous.filter((item) => item.candidateId !== candidateId));
      setNotice("Kandidat berhasil dibuka paksa (override).");
    } catch {
      setError("Override tidak dapat diproses. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function restore(candidateId: string) {
    setPending(candidateId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}/restore`, { method: "POST" });
      if (!response.ok) {
        setError("Kandidat tidak dapat dipulihkan.");
        return;
      }
      setDeleted((previous) => previous.filter((item) => item.id !== candidateId));
      setNotice("Kandidat dipulihkan.");
    } catch {
      setError("Kandidat tidak dapat dipulihkan. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <section className="override-panel" aria-labelledby="override-panel-title">
        <h2 id="override-panel-title">Override Lock Lintas-Birdep</h2>
        <p className="override-panel__hint">Membuka paksa kandidat yang terkunci Birdep manapun, tanpa memandang aturan periode. Setiap aksi wajib alasan dan tercatat audit `OVERRIDE`.</p>
        {error ? <p className="account-manager__error" role="alert">{error}</p> : null}
        {notice ? <p className="account-manager__notice" role="status">{notice}</p> : null}
        {locks.length === 0 ? (
          <p className="candidate-dashboard__empty">Tidak ada kandidat yang sedang terkunci.</p>
        ) : (
          <ul className="override-panel__list">
            {locks.map((lock) => (
              <li key={lock.candidateId}>
                <div>
                  <strong>{lock.candidateName}</strong>
                  <span>{lock.registrationNumber ?? "--"} &middot; dikunci {lock.departmentName} oleh {lock.lockedByName}</span>
                  <span className="override-panel__reason">&ldquo;{lock.lockReason}&rdquo;</span>
                </div>
                <div className="override-panel__action">
                  <input
                    type="text"
                    placeholder="Alasan override..."
                    value={reasonDraft[lock.candidateId] ?? ""}
                    onChange={(event) => setReasonDraft((previous) => ({ ...previous, [lock.candidateId]: event.target.value }))}
                  />
                  <button type="button" disabled={pending === lock.candidateId} onClick={() => void override(lock.candidateId)}>
                    {pending === lock.candidateId ? <LoaderCircle aria-hidden="true" className="spin" size={13} /> : <Unlock aria-hidden="true" size={13} />}
                    Override unlock
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="override-panel" aria-labelledby="deleted-panel-title">
        <h2 id="deleted-panel-title">Kandidat Terhapus (Soft Delete)</h2>
        {deleted.length === 0 ? (
          <p className="candidate-dashboard__empty">Tidak ada kandidat yang dihapus.</p>
        ) : (
          <ul className="override-panel__list">
            {deleted.map((candidate) => (
              <li key={candidate.id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.registrationNumber ?? "--"} &middot; dihapus {new Date(candidate.deletedAt).toLocaleString("id-ID")}</span>
                </div>
                <div className="override-panel__action">
                  <button type="button" disabled={pending === candidate.id} onClick={() => void restore(candidate.id)}>
                    {pending === candidate.id ? <LoaderCircle aria-hidden="true" className="spin" size={13} /> : <RotateCcw aria-hidden="true" size={13} />}
                    Pulihkan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
