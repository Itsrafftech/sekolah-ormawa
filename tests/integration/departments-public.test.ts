import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test departments public.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const bph = "78100000-0000-4000-8000-000000000001";
const execA = "78100000-0000-4000-8000-000000000002";
const execInactive = "78100000-0000-4000-8000-000000000003";
const legA = "78100000-0000-4000-8000-000000000004";
const legB = "78100000-0000-4000-8000-000000000005";

let listDepartmentsByTrack: typeof import("@/server/departments/public").listDepartmentsByTrack;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

beforeAll(async () => {
  ({ listDepartmentsByTrack } = await import("@/server/departments/public"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`TRUNCATE TABLE departments RESTART IDENTITY CASCADE`);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", track, "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES
      ($1, 'PUB-BPH', 'Badan Pengurus Harian', 'BPH', 'BPH', 'EXECUTIVE', 1, true, 'ACTIVE', now(), now()),
      ($2, 'PUB-EXEC-A', 'Birdep Publik A', 'ExecA', 'BIRO', 'EXECUTIVE', 2, true, 'ACTIVE', now(), now()),
      ($3, 'PUB-EXEC-INACTIVE', 'Birdep Nonaktif', 'ExecInactive', 'BIRO', 'EXECUTIVE', 3, false, 'ACTIVE', now(), now()),
      ($4, 'PUB-KOMLEG', 'Komisi Legislasi Publik', 'KomlegPub', 'DEPARTEMEN', 'LEGISLATIVE', 4, true, 'ACTIVE', now(), now()),
      ($5, 'PUB-BADMEDBRND', 'Badan Media Publik', 'BadmedbrndPub', 'BIRO', 'LEGISLATIVE', 5, true, 'ACTIVE', now(), now())`,
    [bph, execA, execInactive, legA, legB],
  );
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE departments RESTART IDENTITY CASCADE`);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("Phase A - listDepartmentsByTrack", () => {
  it("mengelompokkan Birdep aktif per track, mengecualikan BPH dan yang nonaktif", async () => {
    const result = await listDepartmentsByTrack();
    expect(result.executive.map((d) => d.code)).toEqual(["PUB-EXEC-A"]);
    expect(result.legislative.map((d) => d.code).sort()).toEqual(["PUB-BADMEDBRND", "PUB-KOMLEG"]);
    expect(result.executive.some((d) => d.code === "PUB-BPH")).toBe(false);
    expect(result.executive.some((d) => d.code === "PUB-EXEC-INACTIVE")).toBe(false);
  });

  it("setiap item hanya mengekspos field publik (id, code, name, shortName)", async () => {
    const result = await listDepartmentsByTrack();
    const item = result.legislative.find((d) => d.code === "PUB-KOMLEG");
    expect(item).toEqual({ id: legA, code: "PUB-KOMLEG", name: "Komisi Legislasi Publik", shortName: "KomlegPub" });
  });
});
