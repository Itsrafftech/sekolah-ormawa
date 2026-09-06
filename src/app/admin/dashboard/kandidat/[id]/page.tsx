import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link as LinkIcon, Lock } from "lucide-react";

import { DangerZone } from "@/components/admin/danger-zone";
import { LockPanel } from "@/components/admin/lock-panel";
import { NotesPanel } from "@/components/admin/notes-panel";
import { SelectionAdminPanel } from "@/components/admin/selection-admin-panel";
import { SelectionPanel } from "@/components/admin/selection-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { SELECTION_STATUS_LABEL, SELECTION_STATUS_TONE } from "@/features/candidates/selection-status-labels";
import { requireAdminPage } from "@/server/auth/page-guard";
import { getCandidateDetail } from "@/server/candidates/detail";
import { listDepartmentNotes } from "@/server/candidates/notes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ departmentId?: string }>;
};

const UPLOAD_LABEL: Record<string, string> = {
  CV: "CV",
  PHOTO: "Pas foto",
  STUDENT_CARD: "KTM",
};

// Phase C - "Field Khusus Per Birdep" (ADR-043).
const ADKESMAH_FOCUS_LABEL: Record<string, string> = {
  ADVOCACY: "Advokasi Mahasiswa",
  WELFARE: "Kesejahteraan Mahasiswa",
};

export default async function CandidateDetailPage({ params, searchParams }: PageProps) {
  const context = await requireAdminPage();
  const { id } = await params;
  const { departmentId: requestedDepartmentId } = await searchParams;

  const departmentId = context.role === "DEPT_PJ" ? context.departmentId : requestedDepartmentId ?? null;
  if (!departmentId) notFound();

  const candidate = await getCandidateDetail(id, departmentId);
  if (!candidate) notFound();

  const notes = (await listDepartmentNotes(id, departmentId)) ?? [];
  const backHref = context.role === "SUPER_ADMIN" ? `/admin/dashboard?departmentId=${departmentId}` : "/admin/dashboard";
  const fileHref = (fileId: string) => `/api/admin/candidates/${id}/files/${fileId}?departmentId=${departmentId}`;

  return (
    <main className="admin-placeholder" id="main-content">
      <Link href={backHref} className="candidate-detail__back"><ArrowLeft aria-hidden="true" size={15} /> Kembali ke dashboard</Link>

      <section className="candidate-detail__header">
        <div>
          <span className="auth-kicker">{candidate.registrationNumber ?? "Belum ada nomor registrasi"}</span>
          <h1>{candidate.name}</h1>
          <p>{candidate.nim} &middot; {candidate.studyProgramName} &middot; {candidate.className}</p>
        </div>
        {candidate.selection ? (
          <StatusPill tone={SELECTION_STATUS_TONE[candidate.selection.status]}>
            {SELECTION_STATUS_LABEL[candidate.selection.status]}
          </StatusPill>
        ) : candidate.activeLock ? (
          <StatusPill tone="warning"><Lock aria-hidden="true" size={13} /> Terkunci oleh {candidate.activeLock.departmentName}</StatusPill>
        ) : (
          <StatusPill tone="ready">Tersedia</StatusPill>
        )}
      </section>

      <section className="candidate-detail__grid">
        <div className="candidate-detail__card">
          <h2>Identitas</h2>
          <dl>
            <div><dt>Telepon</dt><dd>{candidate.phone}</dd></div>
            <div><dt>Email</dt><dd>{candidate.email}</dd></div>
            <div><dt>Domisili</dt><dd>{candidate.domicile}</dd></div>
            <div><dt>Waktu daftar</dt><dd>{new Date(candidate.submittedAt).toLocaleString("id-ID")}</dd></div>
          </dl>
        </div>

        <div className="candidate-detail__card">
          <h2>Pilihan Birdep</h2>
          {candidate.choices.map((choice) => (
            <article key={choice.departmentId} className="candidate-detail__choice">
              <h3>{choice.rank === "PRIMARY" ? "Pilihan utama" : "Pilihan kedua"} &mdash; {choice.departmentName}</h3>
              <p>{choice.motivation}</p>
              {choice.contribution ? <p><strong>Kontribusi:</strong> {choice.contribution}</p> : null}
            </article>
          ))}
        </div>

        <div className="candidate-detail__card">
          <h2>Esai</h2>
          <p><strong>Pengalaman organisasi:</strong> {candidate.essayOrgExperience}</p>
          <p><strong>Kontribusi:</strong> {candidate.essayContribution}</p>
          <p><strong>Keseimbangan akademik:</strong> {candidate.essayBalance}</p>
        </div>

        <div className="candidate-detail__card">
          <h2>Dokumen</h2>
          <ul className="candidate-detail__files">
            {candidate.uploads.map((upload) => (
              <li key={upload.id}>
                <a href={fileHref(upload.id)} target="_blank" rel="noopener noreferrer">
                  <FileText aria-hidden="true" size={15} /> {UPLOAD_LABEL[upload.kind] ?? upload.kind}: {upload.originalFileName}
                </a>
              </li>
            ))}
            {candidate.uploads.length === 0 ? <li>Tidak ada dokumen tervalidasi.</li> : null}
          </ul>
        </div>

        {candidate.supplemental ? (
          <div className="candidate-detail__card">
            <h2>Data Khusus Birdep</h2>
            <dl>
              {candidate.supplemental.komitMbti ? (
                <div><dt>Tipe MBTI</dt><dd>{candidate.supplemental.komitMbti}</dd></div>
              ) : null}
              {candidate.supplemental.adkesmahFocus ? (
                <div>
                  <dt>Bidang fokus</dt>
                  <dd>{ADKESMAH_FOCUS_LABEL[candidate.supplemental.adkesmahFocus] ?? candidate.supplemental.adkesmahFocus}</dd>
                </div>
              ) : null}
            </dl>
            {/* Phase D - "Portofolio via URL Google Drive" (ADR-045): plain
                links, not private-storage file downloads - the candidate
                is instructed to set sharing to "Anyone with the link can
                view" before submitting, so this can point straight at
                Google Drive. */}
            {candidate.supplemental.portfolioUrl ? (
              <ul className="candidate-detail__files">
                <li>
                  <a href={candidate.supplemental.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">
                    <LinkIcon aria-hidden="true" size={15} /> Portofolio: {candidate.supplemental.portfolioUrl}
                  </a>
                </li>
              </ul>
            ) : null}
            {candidate.supplemental.budgetPlanUrl ? (
              <ul className="candidate-detail__files">
                <li>
                  <a href={candidate.supplemental.budgetPlanUrl} target="_blank" rel="noopener noreferrer nofollow">
                    <LinkIcon aria-hidden="true" size={15} /> RAB: {candidate.supplemental.budgetPlanUrl}
                  </a>
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {candidate.selection ? (
        <SelectionPanel
          key={`${candidate.selection.status}-${departmentId}`}
          candidateId={candidate.id}
          departmentId={departmentId}
          selection={candidate.selection}
        />
      ) : (
        <LockPanel
          key={`${candidate.status}-${candidate.activeLock?.id ?? "none"}`}
          candidateId={candidate.id}
          departmentId={departmentId}
          status={candidate.status}
          activeLock={candidate.activeLock}
          placement={candidate.placement}
        />
      )}

      <NotesPanel candidateId={candidate.id} departmentId={departmentId} initialNotes={notes} currentUserId={context.userId} />

      {context.role === "SUPER_ADMIN" && candidate.selection ? (
        <SelectionAdminPanel candidateId={candidate.id} status={candidate.selection.status} />
      ) : null}

      {context.role === "SUPER_ADMIN" && candidate.status !== "LOCKED" ? (
        <DangerZone candidateId={candidate.id} />
      ) : null}
    </main>
  );
}
