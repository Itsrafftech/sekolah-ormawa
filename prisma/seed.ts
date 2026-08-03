import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  ConfigStatus,
  PrismaClient,
  UnitType,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL wajib tersedia untuk seed development.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const roleFixtures = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Mengelola seluruh domain Sekolah Ormawa.",
  },
  {
    code: "DEPT_PJ",
    name: "PJ Birdep",
    description: "Mengelola kandidat dalam satu scope Birdep.",
  },
] as const;

const permissionFixtures = [
  {
    code: "sekolah.admin.all",
    name: "Administrasi Sekolah",
    description: "Akses administratif lintas Birdep.",
    module: "admin",
  },
  {
    code: "sekolah.candidate.read.own_birdep",
    name: "Lihat Kandidat Birdep",
    description: "Melihat kandidat yang berada dalam scope Birdep sendiri.",
    module: "candidate",
  },
  {
    code: "sekolah.candidate.lock.own_birdep",
    name: "Lock Kandidat Birdep",
    description: "Lock kandidat yang memilih Birdep sendiri.",
    module: "candidate",
  },
  {
    code: "sekolah.note.manage.own_birdep",
    name: "Kelola Catatan Birdep",
    description: "Mengelola catatan internal Birdep sendiri.",
    module: "note",
  },
  {
    code: "sekolah.export.own_birdep",
    name: "Export Kandidat Birdep",
    description: "Membuat export kandidat dalam scope Birdep sendiri.",
    module: "export",
  },
] as const;

const departmentFixtures = [
  ["BPH", "Badan Pengurus Harian", "BPH", UnitType.BPH],
  ["INTERNAL", "Biro Internal", "Internal", UnitType.BIRO],
  ["MEDBRAND", "Biro Media Branding", "Medbrand", UnitType.BIRO],
  ["RISTEK", "Biro Riset dan Teknologi", "Ristek", UnitType.BIRO],
  ["KOMIT", "Biro Kolaborasi dan Kemitraan", "Komit", UnitType.BIRO],
  [
    "ADKESMAH",
    "Departemen Advokasi dan Kesejahteraan Mahasiswa",
    "Adkesmah",
    UnitType.DEPARTEMEN,
  ],
  [
    "AKPRES",
    "Departemen Akademik dan Prestasi",
    "Akpres",
    UnitType.DEPARTEMEN,
  ],
  [
    "KASTRAT",
    "Departemen Kajian dan Aksi Strategis",
    "Kastrat",
    UnitType.DEPARTEMEN,
  ],
  [
    "PERAGA",
    "Departemen Pemuda dan Olahraga",
    "Peraga",
    UnitType.DEPARTEMEN,
  ],
  [
    "PSDM",
    "Departemen Pengembangan Sumber Daya Mahasiswa",
    "PSDM",
    UnitType.DEPARTEMEN,
  ],
  [
    "SENBUD",
    "Departemen Seni dan Budaya",
    "Senbud",
    UnitType.DEPARTEMEN,
  ],
  [
    "SLH",
    "Departemen Sosial dan Lingkungan Hidup",
    "SLH",
    UnitType.DEPARTEMEN,
  ],
  [
    "EKRAF",
    "Departemen Ekonomi Kreatif",
    "Ekraf",
    UnitType.DEPARTEMEN,
  ],
] as const;

const FIXTURE_SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const FIXTURE_DEPT_PJ_ID = "00000000-0000-4000-8000-000000000002";
const FIXTURE_PERIOD_ID = "00000000-0000-4000-8000-000000000063";
const FIXTURE_STUDY_PROGRAM_ID = "00000000-0000-4000-8000-000000000100";

async function seed() {
  for (const role of roleFixtures) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }

  for (const permission of permissionFixtures) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }

  const allPermissionCodes = permissionFixtures.map(({ code }) => code);
  const pjPermissionCodes = allPermissionCodes.filter(
    (code) => code !== "sekolah.admin.all",
  );

  for (const permissionCode of allPermissionCodes) {
    await prisma.rolePermission.upsert({
      where: {
        roleCode_permissionCode: {
          roleCode: "SUPER_ADMIN",
          permissionCode,
        },
      },
      update: {},
      create: { roleCode: "SUPER_ADMIN", permissionCode },
    });
  }

  for (const permissionCode of pjPermissionCodes) {
    await prisma.rolePermission.upsert({
      where: {
        roleCode_permissionCode: {
          roleCode: "DEPT_PJ",
          permissionCode,
        },
      },
      update: {},
      create: { roleCode: "DEPT_PJ", permissionCode },
    });
  }

  for (const [index, [code, name, shortName, unitType]] of departmentFixtures.entries()) {
    await prisma.department.upsert({
      where: { code },
      update: {
        name,
        shortName,
        unitType,
        sortOrder: index,
        configStatus: ConfigStatus.DRAFT,
      },
      create: {
        code,
        name,
        shortName,
        unitType,
        sortOrder: index,
        configStatus: ConfigStatus.DRAFT,
        description: "Fixture draft - wajib diverifikasi sebelum publikasi.",
      },
    });
  }

  const period = await prisma.recruitmentPeriod.upsert({
    where: { code: "DRAFT-A63-DEV" },
    update: {
      name: "Fixture Periode Sekolah Ormawa Angkatan 63",
      cohortCode: 63,
      entryYear: null,
      registrationPrefix: null,
      configStatus: ConfigStatus.DRAFT,
    },
    create: {
      id: FIXTURE_PERIOD_ID,
      code: "DRAFT-A63-DEV",
      name: "Fixture Periode Sekolah Ormawa Angkatan 63",
      cohortCode: 63,
      entryYear: null,
      registrationPrefix: null,
      configStatus: ConfigStatus.DRAFT,
      choice2Required: true,
      allowUnlock: false,
    },
  });

  const departments = await prisma.department.findMany({
    select: { id: true, code: true },
  });

  for (const department of departments) {
    await prisma.periodDepartment.upsert({
      where: {
        periodId_departmentId: {
          periodId: period.id,
          departmentId: department.id,
        },
      },
      update: {
        acceptsApplications: false,
        quota: null,
      },
      create: {
        periodId: period.id,
        departmentId: department.id,
        acceptsApplications: false,
        quota: null,
      },
    });
  }

  await prisma.studyProgram.upsert({
    where: { code: "DRAFT-PRODI-A" },
    update: {
      name: "Program Studi Fixture A",
      configStatus: ConfigStatus.DRAFT,
      isActive: false,
    },
    create: {
      id: FIXTURE_STUDY_PROGRAM_ID,
      code: "DRAFT-PRODI-A",
      name: "Program Studi Fixture A",
      configStatus: ConfigStatus.DRAFT,
      isActive: false,
    },
  });

  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const deptPjPassword = process.env.SEED_DEPT_PJ_PASSWORD;

  if (!superAdminPassword || !deptPjPassword) {
    throw new Error(
      "SEED_SUPER_ADMIN_PASSWORD dan SEED_DEPT_PJ_PASSWORD wajib untuk fixture auth.",
    );
  }

  const ristek = await prisma.department.findUniqueOrThrow({
    where: { code: "RISTEK" },
  });

  const temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.upsert({
    where: { email: "superadmin.fixture@sekolah.local" },
    update: {
      name: "Super Admin Fixture",
      role: "SUPER_ADMIN",
      departmentId: null,
      banned: false,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt,
    },
    create: {
      id: FIXTURE_SUPER_ADMIN_ID,
      name: "Super Admin Fixture",
      email: "superadmin.fixture@sekolah.local",
      emailVerified: true,
      role: "SUPER_ADMIN",
      departmentId: null,
      banned: false,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt,
    },
  });

  await prisma.user.upsert({
    where: { email: "pj.ristek.fixture@sekolah.local" },
    update: {
      name: "PJ Ristek Fixture",
      role: "DEPT_PJ",
      departmentId: ristek.id,
      banned: false,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt,
    },
    create: {
      id: FIXTURE_DEPT_PJ_ID,
      name: "PJ Ristek Fixture",
      email: "pj.ristek.fixture@sekolah.local",
      emailVerified: true,
      role: "DEPT_PJ",
      departmentId: ristek.id,
      banned: false,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt,
    },
  });

  const [superAdminHash, deptPjHash] = await Promise.all([
    hashPassword(superAdminPassword),
    hashPassword(deptPjPassword),
  ]);

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: FIXTURE_SUPER_ADMIN_ID,
      },
    },
    update: { password: superAdminHash },
    create: {
      id: "00000000-0000-4000-8000-100000000001",
      providerId: "credential",
      accountId: FIXTURE_SUPER_ADMIN_ID,
      userId: FIXTURE_SUPER_ADMIN_ID,
      password: superAdminHash,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: FIXTURE_DEPT_PJ_ID,
      },
    },
    update: { password: deptPjHash },
    create: {
      id: "00000000-0000-4000-8000-100000000002",
      providerId: "credential",
      accountId: FIXTURE_DEPT_PJ_ID,
      userId: FIXTURE_DEPT_PJ_ID,
      password: deptPjHash,
    },
  });

  console.log(
    "Seed sintetis selesai: role, permission, 13 unit draft, periode A63 draft, prodi fixture, dan 2 akun fixture.",
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Seed development gagal.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
