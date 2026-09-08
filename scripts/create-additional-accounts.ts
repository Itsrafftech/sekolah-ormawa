// "Tambah Role Baru dan 2 Akun" - one-off provisioning script for the two
// specific production accounts requested (one DEPT_PJ, one new
// KETUA_PELAKSANA). Safe to re-run (idempotent): an email that already has
// a User row is skipped and reported, never duplicated or overwritten.
//
// Run with (DATABASE_URL read from the environment - never hardcoded here):
//   npx tsx scripts/create-additional-accounts.ts
//
// Prerequisite: `prisma db seed` must already have run - this script needs
// (1) an existing SUPER_ADMIN user to attribute audit log rows to, and (2)
// the KETUA_PELAKSANA role row (added to prisma/seed.ts's roleFixtures)
// to already exist, since users.role is a foreign key to roles.code.
//
// Why this duplicates createPjAccount() (src/server/admin/accounts.ts)
// instead of importing it: identical reasoning to scripts/create-pj-
// accounts.ts (see that file's header) - every module under src/server/**
// starts with `import "server-only"`, which throws under a plain
// tsx/Node import path. Per "jangan ubah kode aplikasi apapun", src/
// server/** is left untouched; only genuinely server-only-free leaf
// modules are imported below, and the account-creation transaction
// mirrors createPjAccount()'s fields exactly (mustChangePassword: true, a
// throwaway random password hash never surfaced anywhere, a one-time
// setup link delivered only through EmailOutbox ACCOUNT_SETUP, and an
// audit log row) - generalized here to also support a departmentless
// KETUA_PELAKSANA account (createPjAccount() hardcodes role: "DEPT_PJ"
// and a required department, so it could not be reused as-is even if the
// server-only constraint did not apply).

import { randomBytes, randomUUID } from "node:crypto";

import { normalizeAdminEmail } from "@/features/auth/contracts";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";

type AccountSpec =
  | { role: "DEPT_PJ"; email: string; deptCode: string }
  | { role: "KETUA_PELAKSANA"; email: string; name: string };

const ACCOUNTS: AccountSpec[] = [
  { role: "DEPT_PJ", email: "riadisuprialma@apps.ipb.ac.id", deptCode: "MEDBRAND" },
  { role: "KETUA_PELAKSANA", email: "ghilaragusta@apps.ipb.ac.id", name: "Ketua Pelaksana" },
];

type Outcome =
  | { status: "created"; email: string; role: string }
  | { status: "already_exists"; email: string; role: string }
  | { status: "department_not_found"; email: string; role: string }
  | { status: "failed"; email: string; role: string; error: string };

async function main() {
  const environment = getServerEnvironment();
  const now = new Date();

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!superAdmin) {
    throw new Error(
      "Tidak ada akun SUPER_ADMIN di database - jalankan `prisma db seed` terlebih dahulu sebelum script ini.",
    );
  }

  console.log(`Memproses ${ACCOUNTS.length} akun...\n`);
  const outcomes: Outcome[] = [];

  for (const account of ACCOUNTS) {
    const email = normalizeAdminEmail(account.email);
    try {
      // Same active-department guard as createPjAccount() - only applies
      // to DEPT_PJ; KETUA_PELAKSANA has no department at all (ADR: same
      // "no departmentId" invariant as SUPER_ADMIN, enforced by
      // assertValidDepartmentScope/requireAuthenticatedUser).
      const department =
        account.role === "DEPT_PJ"
          ? await prisma.department.findFirst({ where: { code: account.deptCode, isActive: true } })
          : null;
      if (account.role === "DEPT_PJ" && !department) {
        outcomes.push({ status: "department_not_found", email, role: account.role });
        console.log(`  SKIP  dept "${account.deptCode}" tidak ditemukan/tidak aktif  -  ${email}`);
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        outcomes.push({ status: "already_exists", email, role: account.role });
        console.log(`  SKIP  akun sudah ada  -  ${email}`);
        continue;
      }

      const userId = randomUUID();
      const name = account.role === "DEPT_PJ" ? `PJ ${department!.name}` : account.name;
      // Throwaway hash, immediately discarded after this line - nobody,
      // including whoever runs this script, ever sees a usable initial
      // password. The account only becomes usable through the one-time
      // setup link below.
      const throwawayHash = await hashPassword(randomBytes(32).toString("base64url"));
      const setupToken = randomBytes(32).toString("base64url");
      const tokenHash = sha256(setupToken);
      const expiresAt = new Date(now.getTime() + environment.TEMP_PASSWORD_TTL_SECONDS * 1000);
      const setupUrl = new URL("/admin/reset-password", environment.NEXT_PUBLIC_APP_URL);
      setupUrl.searchParams.set("token", setupToken);

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            name,
            email,
            emailVerified: false,
            role: account.role,
            departmentId: department?.id ?? null,
            banned: false,
            isActive: true,
            mustChangePassword: true,
            temporaryPasswordExpiresAt: expiresAt,
          },
        });
        await tx.account.create({
          data: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: throwawayHash,
          },
        });
        await tx.passwordResetToken.create({
          data: { id: randomUUID(), userId, tokenHash, expiresAt },
        });
        await tx.emailOutbox.create({
          data: {
            type: "ACCOUNT_SETUP",
            recipientHash: sha256(email),
            encryptedPayload: encryptJson(
              {
                kind: "ACCOUNT_SETUP",
                recipient: email,
                recipientName: name,
                setupUrl: setupUrl.toString(),
                expiresAt: expiresAt.toISOString(),
              },
              environment.AUTH_SECRET,
            ),
            maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
            idempotencyKey: `account-setup:${userId}`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: superAdmin.id,
            action: "CREATE",
            entityType: "ACCOUNT",
            entityId: userId,
            departmentId: department?.id ?? null,
            afterJson: {
              role: account.role,
              departmentId: department?.id ?? null,
              source: "scripts/create-additional-accounts.ts",
            },
            requestId: randomUUID(),
            reason: "bulk-provision-script",
          },
        });
      });

      outcomes.push({ status: "created", email, role: account.role });
      console.log(`  OK    ${email}  ->  ${account.role}${department ? ` (${department.name})` : ""} (email setup terkirim ke outbox)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ status: "failed", email, role: account.role, error: message });
      console.log(`  GAGAL ${email}  -  ${message}`);
    }
  }

  const created = outcomes.filter((o) => o.status === "created");
  const alreadyExists = outcomes.filter((o) => o.status === "already_exists");
  const deptNotFound = outcomes.filter((o) => o.status === "department_not_found");
  const failed = outcomes.filter((o) => o.status === "failed");

  console.log("\n=== Ringkasan ===");
  console.log(`Berhasil dibuat             : ${created.length}`);
  console.log(`Sudah ada (dilewati)        : ${alreadyExists.length}`);
  console.log(`Dept tidak ditemukan (skip) : ${deptNotFound.length}`);
  console.log(`Gagal                       : ${failed.length}`);

  if (alreadyExists.length > 0) {
    console.log("\nSudah ada:");
    for (const o of alreadyExists) console.log(`  - ${o.email} (${o.role})`);
  }
  if (deptNotFound.length > 0) {
    console.log("\nDept tidak ditemukan/tidak aktif:");
    for (const o of deptNotFound) console.log(`  - ${o.email} (${o.role})`);
  }
  if (failed.length > 0) {
    console.log("\nGagal:");
    for (const o of failed) console.log(`  - ${o.email} (${o.role}): ${o.error}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Script gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
