import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test broadcast.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const periodId = "83100000-0000-4000-8000-000000000001";
const deptA = "83200000-0000-4000-8000-000000000001";
const deptB = "83300000-0000-4000-8000-000000000001";
const studyProgramId = "83400000-0000-4000-8000-000000000001";
const superAdminId = "83500000-0000-4000-8000-000000000001";

let previewBroadcast: typeof import("@/server/broadcast/broadcast").previewBroadcast;
let sendBroadcast: typeof import("@/server/broadcast/broadcast").sendBroadcast;
let BroadcastError: typeof import("@/server/broadcast/broadcast").BroadcastError;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase7Integration/1.0", "X-Forwarded-For": "203.0.113.10" });
}

async function insertCandidate(id: string, departmentId: string): Promise<void> {
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgramId", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track)
     VALUES ($1, $2, $3, 'Kandidat Broadcast Fixture', $4, $4, 63, 2026, 'Kelas B7', $5, '081200000001', $6, $6, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE')`,
    [id, periodId, `REG-${id.slice(-6)}`, `NIM-${id.slice(-6)}`, studyProgramId, `${id}@example.test`],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis', now(), now())`,
    [randomUUID(), id, departmentId],
  );
}

beforeAll(async () => {
  ({ previewBroadcast, sendBroadcast, BroadcastError } = await import("@/server/broadcast/broadcast"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      email_outbox, candidate_choices, candidates, study_programs,
      recruitment_periods, departments, audit_logs
    RESTART IDENTITY CASCADE
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'BC-A', 'Birdep Broadcast A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'BC-B', 'Birdep Broadcast B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now())`,
    [deptA, deptB],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE7-BC-TEST', 'Periode Sintetis Broadcast', 'OPEN', 'ACTIVE', 63, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-B7', 'Program Studi Broadcast', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
  await insertCandidate(randomUUID(), deptA);
  await insertCandidate(randomUUID(), deptA);
  await insertCandidate(randomUUID(), deptB);
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      email_outbox, candidate_choices, candidates, study_programs,
      recruitment_periods, departments, audit_logs
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("F7-04 broadcast guard", () => {
  it("preview menghitung penerima sesuai filter tanpa mengirim apa pun", async () => {
    const previewAll = await previewBroadcast({
      filter: { periodId },
      content: { subject: "Pengumuman", body: "Ini adalah isi pengumuman untuk kandidat." },
    });
    expect(previewAll.count).toBe(3);

    const previewDeptA = await previewBroadcast({
      filter: { periodId, departmentId: deptA },
      content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
    });
    expect(previewDeptA.count).toBe(2);

    const outboxCount = await pool.query(`SELECT count(*)::int AS count FROM email_outbox`);
    expect(outboxCount.rows[0].count).toBe(0);
  });

  it("menolak send tanpa preview token yang valid untuk payload tsb", async () => {
    await expect(
      sendBroadcast({
        filter: { periodId, departmentId: deptA },
        content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
        previewToken: "invalid.token",
        actorUserId: superAdminId,
        headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_TOKEN_INVALID", status: 409 });
  });

  it("menolak send saat konten diubah setelah preview (token tidak cocok payload baru)", async () => {
    const preview = await previewBroadcast({
      filter: { periodId, departmentId: deptA },
      content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
    });
    await expect(
      sendBroadcast({
        filter: { periodId, departmentId: deptA },
        content: { subject: "Pengumuman A DIUBAH", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
        previewToken: preview.previewToken,
        actorUserId: superAdminId,
        headers: headers(),
      }),
    ).rejects.toBeInstanceOf(BroadcastError);
  });

  it("send yang valid menulis EmailOutbox idempotent dan audit BROADCAST; replay token yang sama tidak duplikat", async () => {
    const preview = await previewBroadcast({
      filter: { periodId, departmentId: deptA },
      content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
    });

    const result = await sendBroadcast({
      filter: { periodId, departmentId: deptA },
      content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
      previewToken: preview.previewToken,
      actorUserId: superAdminId,
      headers: headers(),
    });
    expect(result.sent).toBe(2);

    const outboxAfterFirst = await pool.query(`SELECT count(*)::int AS count FROM email_outbox WHERE type='BROADCAST'`);
    expect(outboxAfterFirst.rows[0].count).toBe(2);

    const audit = await pool.query(`SELECT action FROM audit_logs WHERE "entityType"='BROADCAST'`);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].action).toBe("BROADCAST");

    const replay = await sendBroadcast({
      filter: { periodId, departmentId: deptA },
      content: { subject: "Pengumuman A", body: "Ini adalah isi pengumuman untuk kandidat Birdep A." },
      previewToken: preview.previewToken,
      actorUserId: superAdminId,
      headers: headers(),
    });
    expect(replay.sent).toBe(2);

    const outboxAfterReplay = await pool.query(`SELECT count(*)::int AS count FROM email_outbox WHERE type='BROADCAST'`);
    expect(outboxAfterReplay.rows[0].count).toBe(2);
  });

  it("menolak send saat tidak ada penerima yang cocok", async () => {
    const preview = await previewBroadcast({
      filter: { periodId, placementStatus: "PLACED" },
      content: { subject: "Tidak ada penerima", body: "Filter ini seharusnya tidak menghasilkan penerima." },
    });
    expect(preview.count).toBe(0);
    await expect(
      sendBroadcast({
        filter: { periodId, placementStatus: "PLACED" },
        content: { subject: "Tidak ada penerima", body: "Filter ini seharusnya tidak menghasilkan penerima." },
        previewToken: preview.previewToken,
        actorUserId: superAdminId,
        headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "NO_RECIPIENTS", status: 422 });
  });

  it("token yang kedaluwarsa ditolak", async () => {
    const preview = await previewBroadcast({
      filter: { periodId, departmentId: deptB },
      content: { subject: "Kedaluwarsa", body: "Pesan ini seharusnya kedaluwarsa sebelum dikirim." },
    });
    await expect(
      sendBroadcast({
        filter: { periodId, departmentId: deptB },
        content: { subject: "Kedaluwarsa", body: "Pesan ini seharusnya kedaluwarsa sebelum dikirim." },
        previewToken: preview.previewToken,
        actorUserId: superAdminId,
        headers: headers(),
        now: new Date(Date.now() + 11 * 60 * 1000),
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_TOKEN_INVALID" });
  });
});
