import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link as LinkIcon, Lock } from "lucide-react";

import { DangerZone } from "@/components/admin/danger-zone";
import { LockPanel } from "@/components/admin/lock-panel";
import { NotesPanel } from "@/components/admin/notes-panel";
import { StatusPill } from "@/components/ui/status-pill";
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
  PORTFOLIO: "Portofolio",
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
        {candidate.activeLock ? (
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

        {candidate.portfolios.length > 0 ? (
          <div className="candidate-detail__card">
            <h2>Portofolio</h2>
            <ul className="candidate-detail__files">
              {candidate.portfolios.map((item) => (
                <li key={item.id}>
                  {item.type === "FILE" && item.file ? (
                    <a href={fileHref(item.file.id)} target="_blank" rel="noopener noreferrer">
                      <FileText aria-hidden="true" size={15} /> {item.title ?? item.file.originalFileName}
                    </a>
                  ) : (
                    <a href={item.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer nofollow">
                      <LinkIcon aria-hidden="true" size={15} /> {item.title ?? item.externalUrl}
                    </a>
                  )}
                  {item.description ? <p>{item.description}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <LockPanel
        key={`${candidate.status}-${candidate.activeLock?.id ?? "none"}`}
        candidateId={candidate.id}
        departmentId={departmentId}
        status={candidate.status}
        activeLock={candidate.activeLock}
        placement={candidate.placement}
      />

      <NotesPanel candidateId={candidate.id} departmentId={departmentId} initialNotes={notes} currentUserId={context.userId} />

      {context.role === "SUPER_ADMIN" && candidate.status !== "LOCKED" ? (
        <DangerZone candidateId={candidate.id} />
      ) : null}
    </main>
  );
}
