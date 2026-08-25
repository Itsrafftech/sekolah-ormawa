"use client";

import { useState } from "react";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";

import type { DepartmentNoteDto } from "@/features/candidates/contracts";
import { NOTE_BODY_MAX_LENGTH } from "@/features/candidates/validation";

type NotesPanelProps = {
  candidateId: string;
  departmentId: string;
  initialNotes: DepartmentNoteDto[];
  currentUserId: string;
};

function notesEndpoint(candidateId: string, departmentId: string, noteId?: string) {
  const base = `/api/admin/candidates/${candidateId}/notes${noteId ? `/${noteId}` : ""}`;
  return `${base}?departmentId=${departmentId}`;
}

export function NotesPanel({ candidateId, departmentId, initialNotes, currentUserId }: NotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPending("create");
    setError(null);
    try {
      const response = await fetch(notesEndpoint(candidateId, departmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = (await response.json()) as { data?: DepartmentNoteDto; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Catatan tidak dapat disimpan.");
        return;
      }
      setNotes((previous) => [result.data as DepartmentNoteDto, ...previous]);
      setDraft("");
    } catch {
      setError("Catatan tidak dapat disimpan. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function saveEdit(noteId: string) {
    const body = editingBody.trim();
    if (!body) return;
    setPending(noteId);
    setError(null);
    try {
      const response = await fetch(notesEndpoint(candidateId, departmentId, noteId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = (await response.json()) as { data?: DepartmentNoteDto; error?: { message?: string } };
      if (!response.ok || !result.data) {
        setError(result.error?.message ?? "Catatan tidak dapat diperbarui.");
        return;
      }
      setNotes((previous) => previous.map((note) => (note.id === noteId ? result.data as DepartmentNoteDto : note)));
      setEditingId(null);
    } catch {
      setError("Catatan tidak dapat diperbarui. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  async function removeNote(noteId: string) {
    setPending(noteId);
    setError(null);
    try {
      const response = await fetch(notesEndpoint(candidateId, departmentId, noteId), { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        setError("Catatan tidak dapat dihapus.");
        return;
      }
      setNotes((previous) => previous.filter((note) => note.id !== noteId));
    } catch {
      setError("Catatan tidak dapat dihapus. Periksa koneksi.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="notes-panel" aria-labelledby="notes-panel-title">
      <h3 id="notes-panel-title">Catatan Birdep</h3>
      <p className="notes-panel__hint">Hanya terlihat oleh Birdep ini dan Super Admin.</p>

      <form className="notes-panel__form" onSubmit={submitNote}>
        <label htmlFor="note-draft" className="sr-only">Tulis catatan baru</label>
        <textarea
          id="note-draft"
          value={draft}
          maxLength={NOTE_BODY_MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tulis catatan evaluasi kandidat..."
          rows={3}
        />
        <button type="submit" disabled={pending === "create" || draft.trim().length === 0}>
          {pending === "create" ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : null}
          Simpan catatan
        </button>
      </form>

      {error ? <p className="notes-panel__error" role="alert">{error}</p> : null}

      {notes.length === 0 ? (
        <p className="notes-panel__empty">Belum ada catatan.</p>
      ) : (
        <ul className="notes-panel__list">
          {notes.map((note) => (
            <li key={note.id}>
              {editingId === note.id ? (
                <div className="notes-panel__edit">
                  <textarea
                    value={editingBody}
                    maxLength={NOTE_BODY_MAX_LENGTH}
                    onChange={(event) => setEditingBody(event.target.value)}
                    rows={3}
                  />
                  <div className="notes-panel__edit-actions">
                    <button type="button" onClick={() => void saveEdit(note.id)} disabled={pending === note.id}>
                      Simpan
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="notes-panel__body">{note.body}</p>
                  <div className="notes-panel__meta">
                    <span>{note.createdByName}{note.createdById === currentUserId ? " (Anda)" : ""}</span>
                    <span>{new Date(note.createdAt).toLocaleString("id-ID")}</span>
                    <button
                      type="button"
                      aria-label="Ubah catatan"
                      onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}
                    >
                      <Pencil aria-hidden="true" size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Hapus catatan"
                      disabled={pending === note.id}
                      onClick={() => void removeNote(note.id)}
                    >
                      <Trash2 aria-hidden="true" size={13} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
