"use client";

import { useState } from "react";
import { LoaderCircle, Megaphone, Send } from "lucide-react";

import type { BroadcastPreviewResult } from "@/features/broadcast/contracts";
import { PLACEMENT_STATUS_VALUES, type PlacementStatusValue } from "@/features/candidates/contracts";
import type { DepartmentOption } from "@/features/candidates/contracts";

type BroadcastComposerProps = {
  periodId: string;
  periodName: string;
  departments: DepartmentOption[];
};

const PLACEMENT_LABEL: Record<PlacementStatusValue, string> = {
  UNDER_REVIEW: "Sedang ditinjau",
  PLACED: "Ditempatkan",
  WAITLISTED: "Daftar tunggu",
  NOT_SELECTED: "Tidak dipilih",
  WITHDRAWN: "Mengundurkan diri",
};

export function BroadcastComposer({ periodId, periodName, departments }: BroadcastComposerProps) {
  const [departmentId, setDepartmentId] = useState("");
  const [placementStatus, setPlacementStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<BroadcastPreviewResult | null>(null);
  const [pending, setPending] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  function currentFilter() {
    return {
      periodId,
      ...(departmentId ? { departmentId } : {}),
      ...(placementStatus ? { placementStatus } : {}),
    };
  }

  function invalidatePreview() {
    setPreview(null);
    setSentCount(null);
  }

  async function runPreview() {
    setPending("preview");
    setError(null);
    setSentCount(null);
    try {
      const response = await fetch("/api/admin/broadcast/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: currentFilter(), content: { subject, body } }),
      });
      const result = (await response.json()) as { data?: BroadcastPreviewResult; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Preview tidak dapat dimuat.");
        return;
      }
      setPreview(result.data);
    } catch {
      setError("Preview tidak dapat dimuat. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function confirmSend() {
    if (!preview) return;
    setPending("send");
    setError(null);
    try {
      const response = await fetch("/api/admin/broadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: currentFilter(), content: { subject, body }, previewToken: preview.previewToken }),
      });
      const result = (await response.json()) as { data?: { sent: number }; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Broadcast tidak dapat dikirim.");
        return;
      }
      setSentCount(result.data.sent);
      setPreview(null);
    } catch {
      setError("Broadcast tidak dapat dikirim. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="broadcast-composer" aria-labelledby="broadcast-title">
      <h2 id="broadcast-title"><Megaphone aria-hidden="true" size={20} /> Broadcast Kandidat &mdash; {periodName}</h2>
      <p className="override-panel__hint">Wajib preview sebelum kirim. Konten yang diubah setelah preview membatalkan token dan harus di-preview ulang.</p>

      <div className="broadcast-composer__filters">
        <label>Birdep (opsional)
          <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); invalidatePreview(); }}>
            <option value="">Semua Birdep</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label>Status placement (opsional)
          <select value={placementStatus} onChange={(event) => { setPlacementStatus(event.target.value); invalidatePreview(); }}>
            <option value="">Semua status</option>
            {PLACEMENT_STATUS_VALUES.map((value) => <option key={value} value={value}>{PLACEMENT_LABEL[value]}</option>)}
          </select>
        </label>
      </div>

      <label className="broadcast-composer__field">Subjek
        <input value={subject} onChange={(event) => { setSubject(event.target.value); invalidatePreview(); }} maxLength={200} />
      </label>
      <label className="broadcast-composer__field">Isi pesan
        <textarea value={body} onChange={(event) => { setBody(event.target.value); invalidatePreview(); }} rows={6} maxLength={5000} />
      </label>

      {error ? <p className="account-manager__error" role="alert">{error}</p> : null}
      {sentCount !== null ? <p className="account-manager__notice" role="status">Broadcast terkirim ke {sentCount} kandidat lewat email outbox.</p> : null}

      {!preview ? (
        <button
          type="button"
          className="broadcast-composer__preview-button"
          disabled={pending !== null || subject.trim().length < 3 || body.trim().length < 10}
          onClick={() => void runPreview()}
        >
          {pending === "preview" ? <LoaderCircle aria-hidden="true" className="spin" size={15} /> : null}
          Preview penerima
        </button>
      ) : (
        <div className="broadcast-composer__preview">
          <p><strong>{preview.count}</strong> kandidat akan menerima pesan ini.</p>
          {preview.sample.length > 0 ? (
            <p className="override-panel__hint">Contoh: {preview.sample.join(", ")}{preview.count > preview.sample.length ? ", ..." : ""}</p>
          ) : null}
          <div className="broadcast-composer__preview-actions">
            <button type="button" disabled={pending !== null || preview.count === 0} onClick={() => void confirmSend()}>
              {pending === "send" ? <LoaderCircle aria-hidden="true" className="spin" size={15} /> : <Send aria-hidden="true" size={15} />}
              Kirim ke {preview.count} kandidat
            </button>
            <button type="button" disabled={pending !== null} onClick={() => setPreview(null)}>Batal, ubah pesan</button>
          </div>
        </div>
      )}
    </section>
  );
}
