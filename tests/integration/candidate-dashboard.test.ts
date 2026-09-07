import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test dashboard PJ.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });

const periodId = "81000000-0000-4000-8000-000000000001";
const deptA = "82000000-0000-4000-8000-000000000001";
const deptB = "82000000-0000-4000-8000-000000000002";
const deptC = "82000000-0000-4000-8000-000000000003";
const studyProgramId = "83000000-0000-4000-8000-000000000001";
const superAdminUserId = "84000000-0000-4000-8000-000000000001";
const pjAUserId = "84000000-0000-4000-8000-000000000002";
const pjBUserId = "84000000-0000-4000-8000-000000000003";

const c1 = "85000000-0000-4000-8000-000000000001";
const c2 = "85000000-0000-4000-8000-000000000002";
const c3Locked = "85000000-0000-4000-8000-000000000003";
const c4Search = "85000000-0000-4000-8000-000000000004";
const paginationIds = Array.from(
  { length: 5 },
  (_, i) => `85000000-0000-4000-9000-00000000010${i}`,
);

const uploadValidated = "86000000-0000-4000-8000-000000000001";
const uploadPending = "86000000-0000-4000-8000-000000000002";
const fileBytes = new TextEncoder().encode("%PDF-1.4 synthetic candidate cv fixture");
// "Guidebook, ketentuan, dan pembayaran": periodId+paymentCode is unique -
// a module-level counter gives every insertCandidate() call in this file
// a distinct code regardless of how many share this file's one periodId.
let paymentCodeCounter = 0;

let requireDepartmentAccess: typeof import("@/server/auth/guard").requireDepartmentAccess;
let listCandidatesForDepartment: typeof import("@/server/candidates/list").listCandidatesForDepartment;
let getCandidateSegmentCounts: typeof import("@/server/candidates/list").getCandidateSegmentCounts;
let getCandidateDetail: typeof import("@/server/candidates/detail").getCandidateDetail;
let findScopedCandidateId: typeof import("@/server/candidates/scope").findScopedCandidateId;
let readScopedCandidateFile: typeof import("@/server/candidates/files").readScopedCandidateFile;
let createDepartmentNote: typeof import("@/server/candidates/notes").createDepartmentNote;
let updateDepartmentNote: typeof import("@/server/candidates/notes").updateDepartmentNote;
let softDeleteDepartmentNote: typeof import("@/server/candidates/notes").softDeleteDepartmentNote;
let listDepartmentNotes: typeof import("@/server/candidates/notes").listDepartmentNotes;
let getPrivateStorage: typeof import("@/server/storage/private-storage").getPrivateStorage;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase5Integration/1.0", "X-Forwarded-For": "203.0.113.5" });
}

function adminContext(role: "SUPER_ADMIN" | "DEPT_PJ", departmentId: string | null, userId: string) {
  return {
    userId,
    sessionId: randomUUID(),
    name: "Fixture User",
    email: `${userId}@example.test`,
    role,
    departmentId,
    departmentName: null,
    mustChangePassword: false,
    permissions: [] as never[],
  };
}

beforeAll(async () => {
  ({ requireDepartmentAccess } = await import("@/server/auth/guard"));
  ({ listCandidatesForDepartment, getCandidateSegmentCounts } = await import("@/server/candidates/list"));
  ({ getCandidateDetail } = await import("@/server/candidates/detail"));
  ({ findScopedCandidateId } = await import("@/server/candidates/scope"));
  ({ readScopedCandidateFile } = await import("@/server/candidates/files"));
  ({ createDepartmentNote, updateDepartmentNote, softDeleteDepartmentNote, listDepartmentNotes } =
    await import("@/server/candidates/notes"));
  ({ getPrivateStorage } = await import("@/server/storage/private-storage"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      department_notes, candidate_locks, candidate_supplemental_data, file_uploads,
      candidate_choices, candidates, study_programs, recruitment_periods,
      period_departments, users, departments, audit_logs, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
    VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
           ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'DASH-A', 'Birdep Dashboard A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'DASH-B', 'Birdep Dashboard B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now()),
            ($3, 'DASH-C', 'Birdep Dashboard C', 'C', 'BIRO', 3, true, 'ACTIVE', now(), now())`,
    [deptA, deptB, deptC],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "entryYear", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE5-TEST', 'Periode Sintetis Phase 5', 'CLOSED', 'ACTIVE', 63, 2026, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-P5', 'Program Studi Dashboard', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
  for (const [id, role, departmentId] of [
    [superAdminUserId, "SUPER_ADMIN", null],
    [pjAUserId, "DEPT_PJ", deptA],
    [pjBUserId, "DEPT_PJ", deptB],
  ] as const) {
    await pool.query(
      `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "departmentId", "sessionVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, false, true, false, $5, 0, now(), now())`,
      [id, `Fixture ${role}`, `${id}@example.test`, role, departmentId],
    );
  }

  async function insertCandidate(input: {
    id: string;
    name: string;
    status: "SUBMITTED" | "LOCKED";
    submittedAt: Date;
    choices: Array<{ departmentId: string; rank: "PRIMARY" | "SECONDARY" }>;
  }) {
    paymentCodeCounter += 1;
    const paymentCode = String(paymentCodeCounter).padStart(3, "0");
    await pool.query(
      `INSERT INTO candidates
        (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgram", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track, "paymentCode", "paymentAmount")
       VALUES ($1, $2, $3, $4, $5, $5, 63, 2026, 'Kelas P5', $6, '081200000000', $7, $7, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', $8, $9, now(), 'EXECUTIVE', $10, $11)`,
      [input.id, periodId, `REG-${input.id.slice(-6)}`, input.name, `NIM-${input.id.slice(-6)}`, "Program Studi Dashboard", `${input.id}@example.test`, input.status, input.submittedAt, paymentCode, 15000 + Number(paymentCode)],
    );
    for (const choice of input.choices) {
      await pool.query(
        `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'Motivasi sintetis', now(), now())`,
        [randomUUID(), input.id, choice.departmentId, choice.rank],
      );
    }
  }

  const base = new Date("2026-08-01T00:00:00.000Z").getTime();
  await insertCandidate({ id: c1, name: "Kandidat Satu", status: "SUBMITTED", submittedAt: new Date(base), choices: [{ departmentId: deptA, rank: "PRIMARY" }, { departmentId: deptB, rank: "SECONDARY" }] });
  await insertCandidate({ id: c2, name: "Kandidat Dua", status: "SUBMITTED", submittedAt: new Date(base + 1000), choices: [{ departmentId: deptA, rank: "SECONDARY" }, { departmentId: deptB, rank: "PRIMARY" }] });
  await insertCandidate({ id: c3Locked, name: "Kandidat Terkunci", status: "LOCKED", submittedAt: new Date(base + 2000), choices: [{ departmentId: deptA, rank: "PRIMARY" }, { departmentId: deptB, rank: "SECONDARY" }] });
  await insertCandidate({ id: c4Search, name: "Zzzunique Kandidat Pencarian", status: "SUBMITTED", submittedAt: new Date(base + 3000), choices: [{ departmentId: deptA, rank: "PRIMARY" }] });
  for (const [index, id] of paginationIds.entries()) {
    await insertCandidate({ id, name: `Kandidat Pagination ${index}`, status: "SUBMITTED", submittedAt: new Date(base + 4000 + index * 1000), choices: [{ departmentId: deptA, rank: "PRIMARY" }] });
  }

  await pool.query(
    `INSERT INTO candidate_locks (id, "candidateId", "departmentId", "lockedByUserId", "lockedAt")
     VALUES ($1, $2, $3, $4, now())`,
    [randomUUID(), c3Locked, deptA, pjAUserId],
  );

  const storage = getPrivateStorage();
  const objectKey = `${periodId}/fixture-${uploadValidated}.pdf`;
  await storage.put(objectKey, fileBytes);
  await pool.query(
    `INSERT INTO file_uploads (id, "candidateId", "periodId", kind, status, bucket, "objectKey", "originalFileName", "declaredMimeType", "detectedMimeType", "sizeBytes", "ownerTokenHash", "uploadedAt", "finalizedAt", "expiresAt")
     VALUES ($1, $2, $3, 'CV', 'VALIDATED', 'development-private', $4, 'cv-fixture.pdf', 'application/pdf', 'application/pdf', $5, 'unused', now(), now(), now() + interval '1 day')`,
    [uploadValidated, c1, periodId, objectKey, fileBytes.byteLength],
  );
  await pool.query(
    `INSERT INTO file_uploads (id, "candidateId", "periodId", kind, status, bucket, "objectKey", "originalFileName", "declaredMimeType", "sizeBytes", "ownerTokenHash", "expiresAt")
     VALUES ($1, $2, $3, 'PHOTO', 'PENDING', 'development-private', $4, 'photo-pending.png', 'image/png', 10, 'unused', now() + interval '1 day')`,
    [uploadPending, c1, periodId, `${periodId}/fixture-${uploadPending}.png`],
  );
}, 60_000);

afterAll(async () => {
  await getPrivateStorage().delete(`${periodId}/fixture-${uploadValidated}.pdf`);
  await pool.query(`
    TRUNCATE TABLE
      department_notes, candidate_locks, candidate_supplemental_data, file_uploads,
      candidate_choices, candidates, study_programs, recruitment_periods,
      period_departments, users, departments, audit_logs, roles
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("F5-01 segmentasi kandidat", () => {
  it("menghitung primary/secondary/locked per Birdep secara terpisah", async () => {
    const countsA = await getCandidateSegmentCounts(deptA, periodId);
    expect(countsA).toEqual({ PRIMARY: 7, SECONDARY: 1, LOCKED: 1 });

    const countsB = await getCandidateSegmentCounts(deptB, periodId);
    expect(countsB).toEqual({ PRIMARY: 1, SECONDARY: 1, LOCKED: 0 });
  });

  it("kandidat yang terkunci Birdep lain hilang dari segmen primary/secondary Birdep tersebut", async () => {
    const result = await listCandidatesForDepartment({
      departmentId: deptB,
      periodId,
      query: { segment: "SECONDARY", search: null, cursor: null, limit: 20, sort: "submittedAt_asc", departmentId: deptB },
    });
    expect(result.items.map((item) => item.id)).toEqual([c1]);
    expect(result.items.some((item) => item.id === c3Locked)).toBe(false);
  });

  it("segmen locked hanya berisi kandidat yang dikunci Birdep itu sendiri", async () => {
    const lockedA = await listCandidatesForDepartment({
      departmentId: deptA,
      periodId,
      query: { segment: "LOCKED", search: null, cursor: null, limit: 20, sort: "submittedAt_asc", departmentId: deptA },
    });
    expect(lockedA.items.map((item) => item.id)).toEqual([c3Locked]);

    const lockedB = await listCandidatesForDepartment({
      departmentId: deptB,
      periodId,
      query: { segment: "LOCKED", search: null, cursor: null, limit: 20, sort: "submittedAt_asc", departmentId: deptB },
    });
    expect(lockedB.items).toEqual([]);
  });
});

describe("F5-02 isolasi Birdep", () => {
  it("findScopedCandidateId menolak Birdep yang tidak dipilih kandidat", async () => {
    await expect(findScopedCandidateId(c1, deptC)).resolves.toBeNull();
  });

  it("findScopedCandidateId menolak Birdep lain untuk kandidat yang sudah terkunci", async () => {
    await expect(findScopedCandidateId(c3Locked, deptB)).resolves.toBeNull();
    await expect(findScopedCandidateId(c3Locked, deptA)).resolves.toBe(c3Locked);
  });

  it("getCandidateDetail mengembalikan null di luar scope", async () => {
    await expect(getCandidateDetail(c1, deptC)).resolves.toBeNull();
    const detail = await getCandidateDetail(c1, deptA);
    expect(detail?.id).toBe(c1);
  });

  it("requireDepartmentAccess: SUPER_ADMIN wajib memilih department, PJ terkunci ke department sendiri", async () => {
    const superContext = adminContext("SUPER_ADMIN", null, superAdminUserId);
    await expect(requireDepartmentAccess(superContext, null)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(requireDepartmentAccess(superContext, deptB)).resolves.toBe(deptB);

    const pjContext = adminContext("DEPT_PJ", deptA, pjAUserId);
    await expect(requireDepartmentAccess(pjContext, null)).resolves.toBe(deptA);
    await expect(requireDepartmentAccess(pjContext, deptA)).resolves.toBe(deptA);
    await expect(requireDepartmentAccess(pjContext, deptB, headers())).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});

describe("F5-03 file viewer", () => {
  it("menyajikan file untuk Birdep dalam scope dan menulis audit FILE_VIEW", async () => {
    const file = await readScopedCandidateFile({
      candidateId: c1,
      fileId: uploadValidated,
      departmentId: deptA,
      actorUserId: pjAUserId,
      headers: headers(),
    });
    expect(file?.originalFileName).toBe("cv-fixture.pdf");
    expect(Buffer.from(file!.bytes).toString("utf8")).toContain("synthetic candidate cv fixture");

    const audit = await pool.query(
      `SELECT action, "entityType", "entityId" FROM audit_logs WHERE "entityType"='FILE_UPLOAD' AND "entityId"=$1`,
      [uploadValidated],
    );
    expect(audit.rows).toEqual([{ action: "FILE_VIEW", entityType: "FILE_UPLOAD", entityId: uploadValidated }]);
  });

  it("menolak akses file di luar scope Birdep", async () => {
    const file = await readScopedCandidateFile({
      candidateId: c1,
      fileId: uploadValidated,
      departmentId: deptC,
      actorUserId: superAdminUserId,
      headers: headers(),
    });
    expect(file).toBeNull();
  });

  it("upload berstatus PENDING tidak tampil pada dokumen kandidat", async () => {
    const detail = await getCandidateDetail(c1, deptA);
    expect(detail?.uploads.some((upload) => upload.id === uploadPending)).toBe(false);
    expect(detail?.uploads.some((upload) => upload.id === uploadValidated)).toBe(true);
  });
});

describe("F5-04 search dan cursor pagination", () => {
  it("search menemukan kandidat berdasarkan nama", async () => {
    const result = await listCandidatesForDepartment({
      departmentId: deptA,
      periodId,
      query: { segment: "PRIMARY", search: "Zzzunique", cursor: null, limit: 20, sort: "submittedAt_asc", departmentId: deptA },
    });
    expect(result.items.map((item) => item.id)).toEqual([c4Search]);
  });

  it("cursor pagination stabil dan tidak tumpang tindih", async () => {
    const page1 = await listCandidatesForDepartment({
      departmentId: deptA,
      periodId,
      query: { segment: "PRIMARY", search: null, cursor: null, limit: 3, sort: "submittedAt_asc", departmentId: deptA },
    });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listCandidatesForDepartment({
      departmentId: deptA,
      periodId,
      query: { segment: "PRIMARY", search: null, cursor: page1.nextCursor, limit: 3, sort: "submittedAt_asc", departmentId: deptA },
    });
    expect(page2.items).toHaveLength(3);

    const page3 = await listCandidatesForDepartment({
      departmentId: deptA,
      periodId,
      query: { segment: "PRIMARY", search: null, cursor: page2.nextCursor, limit: 3, sort: "submittedAt_asc", departmentId: deptA },
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((item) => item.id);
    expect(new Set(allIds).size).toBe(7);

    const submittedTimestamps = [...page1.items, ...page2.items, ...page3.items].map((item) => item.submittedAt);
    const sorted = [...submittedTimestamps].sort();
    expect(submittedTimestamps).toEqual(sorted);
  });
});

describe("catatan Birdep terisolasi", () => {
  it("catatan hanya terlihat oleh Birdep pembuatnya, bukan Birdep lain yang sama-sama punya scope", async () => {
    const created = await createDepartmentNote({
      candidateId: c1,
      departmentId: deptA,
      body: "Catatan evaluasi dari Birdep A.",
      actorUserId: pjAUserId,
      headers: headers(),
    });
    expect(created?.body).toBe("Catatan evaluasi dari Birdep A.");
    expect(created?.createdByName).toContain("DEPT_PJ");

    const notesForA = await listDepartmentNotes(c1, deptA);
    expect(notesForA?.some((note) => note.id === created!.id)).toBe(true);

    const notesForB = await listDepartmentNotes(c1, deptB);
    expect(notesForB).toEqual([]);

    const updated = await updateDepartmentNote({
      noteId: created!.id,
      candidateId: c1,
      departmentId: deptA,
      body: "Catatan diperbarui.",
      actorUserId: pjAUserId,
      headers: headers(),
    });
    expect(updated?.body).toBe("Catatan diperbarui.");

    const crossDeptUpdate = await updateDepartmentNote({
      noteId: created!.id,
      candidateId: c1,
      departmentId: deptB,
      body: "Percobaan lintas Birdep.",
      actorUserId: pjBUserId,
      headers: headers(),
    });
    expect(crossDeptUpdate).toBeNull();

    const removed = await softDeleteDepartmentNote({
      noteId: created!.id,
      candidateId: c1,
      departmentId: deptA,
      actorUserId: pjAUserId,
      headers: headers(),
    });
    expect(removed).toBe(true);

    const notesAfterDelete = await listDepartmentNotes(c1, deptA);
    expect(notesAfterDelete?.some((note) => note.id === created!.id)).toBe(false);

    const auditRows = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='DEPARTMENT_NOTE' AND "entityId"=$1 ORDER BY "createdAt" ASC`,
      [created!.id],
    );
    expect(auditRows.rows.map((row) => row.action)).toEqual(["CREATE", "UPDATE", "SOFT_DELETE"]);
  });

  it("createDepartmentNote menolak kandidat di luar scope", async () => {
    const result = await createDepartmentNote({
      candidateId: c1,
      departmentId: deptC,
      body: "Tidak boleh tersimpan.",
      actorUserId: superAdminUserId,
      headers: headers(),
    });
    expect(result).toBeNull();
  });
});
