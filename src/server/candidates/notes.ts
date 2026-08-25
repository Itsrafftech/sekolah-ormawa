import "server-only";

import type { DepartmentNoteDto } from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/auth/audit";
import { findScopedCandidateId } from "@/server/candidates/scope";

const ENTITY_TYPE = "DEPARTMENT_NOTE";

type NoteRow = {
  id: string;
  candidateId: string;
  body: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

// department_notes.createdById is a denormalized user id (same convention
// as candidate_locks.lockedByUserId / audit_logs.actorUserId) without a
// Prisma relation, so names are resolved with a small batched lookup.
async function resolveCreatorNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

function toDto(note: NoteRow, creatorNames: Map<string, string>): DepartmentNoteDto {
  return {
    id: note.id,
    candidateId: note.candidateId,
    body: note.body,
    createdById: note.createdById,
    createdByName: creatorNames.get(note.createdById) ?? "Pengguna tidak dikenal",
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function listDepartmentNotes(
  candidateId: string,
  departmentId: string,
): Promise<DepartmentNoteDto[] | null> {
  const scopedId = await findScopedCandidateId(candidateId, departmentId);
  if (!scopedId) return null;

  const rows = await prisma.departmentNote.findMany({
    where: { candidateId: scopedId, departmentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const creatorNames = await resolveCreatorNames(rows.map((row) => row.createdById));
  return rows.map((row) => toDto(row, creatorNames));
}

export async function createDepartmentNote(input: {
  candidateId: string;
  departmentId: string;
  body: string;
  actorUserId: string;
  headers: Headers;
}): Promise<DepartmentNoteDto | null> {
  const scopedId = await findScopedCandidateId(input.candidateId, input.departmentId);
  if (!scopedId) return null;

  const note = await prisma.departmentNote.create({
    data: {
      candidateId: scopedId,
      departmentId: input.departmentId,
      body: input.body,
      createdById: input.actorUserId,
    },
  });

  await writeAuditLog({
    action: "CREATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: ENTITY_TYPE,
    entityId: note.id,
    departmentId: input.departmentId,
    afterJson: { candidateId: scopedId, bodyPreview: input.body.slice(0, 200) },
  });

  const creatorNames = await resolveCreatorNames([note.createdById]);
  return toDto(note, creatorNames);
}

export async function updateDepartmentNote(input: {
  noteId: string;
  candidateId: string;
  departmentId: string;
  body: string;
  actorUserId: string;
  headers: Headers;
}): Promise<DepartmentNoteDto | null> {
  const scopedId = await findScopedCandidateId(input.candidateId, input.departmentId);
  if (!scopedId) return null;

  const existing = await prisma.departmentNote.findFirst({
    where: {
      id: input.noteId,
      candidateId: scopedId,
      departmentId: input.departmentId,
      deletedAt: null,
    },
  });
  if (!existing) return null;

  const note = await prisma.departmentNote.update({
    where: { id: existing.id },
    data: { body: input.body },
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: ENTITY_TYPE,
    entityId: note.id,
    departmentId: input.departmentId,
    beforeJson: { bodyPreview: existing.body.slice(0, 200) },
    afterJson: { bodyPreview: input.body.slice(0, 200) },
  });

  const creatorNames = await resolveCreatorNames([note.createdById]);
  return toDto(note, creatorNames);
}

export async function softDeleteDepartmentNote(input: {
  noteId: string;
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  headers: Headers;
}): Promise<boolean> {
  const scopedId = await findScopedCandidateId(input.candidateId, input.departmentId);
  if (!scopedId) return false;

  const existing = await prisma.departmentNote.findFirst({
    where: {
      id: input.noteId,
      candidateId: scopedId,
      departmentId: input.departmentId,
      deletedAt: null,
    },
  });
  if (!existing) return false;

  await prisma.departmentNote.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    action: "SOFT_DELETE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: ENTITY_TYPE,
    entityId: existing.id,
    departmentId: input.departmentId,
    beforeJson: { bodyPreview: existing.body.slice(0, 200) },
  });

  return true;
}
