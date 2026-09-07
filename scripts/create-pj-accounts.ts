// Bulk-provisioning script for production PJ Birdep accounts. Safe to
// re-run (idempotent): an email that already has a User row is skipped and
// reported, never duplicated or overwritten.
//
// Run with (DATABASE_URL read from the environment - never hardcoded here):
//   npx tsx scripts/create-pj-accounts.ts
//
// Prerequisite: `prisma db seed` must already have run (this script looks
// up an existing SUPER_ADMIN user to attribute audit log rows to, and
// aborts up front if none exists).
//
// Why this duplicates createPjAccount() (src/server/admin/accounts.ts)
// instead of importing it: every module under src/server/** starts with
// `import "server-only"`, Next.js's build-time guard against server code
// leaking into a client bundle. That guard throws unconditionally under
// any resolution path other than Next's own bundler - confirmed directly:
// a plain `tsx`/Node import of a "server-only"-guarded module fails
// immediately with "This module cannot be imported from a Client
// Component module...". A standalone `tsx scripts/create-pj-accounts.ts`
// invocation is exactly such a path, so importing that module here was not
// an available option, not a style choice. Per "jangan ubah kode aplikasi
// apapun", src/server/** itself is left untouched - only genuinely
// server-only-free leaf modules are imported below (prisma client, env,
// password hashing, crypto helpers, email normalization), and the account
// creation transaction below mirrors createPjAccount()'s fields exactly:
// mustChangePassword: true, a throwaway random password hash that is
// never surfaced anywhere (not logged, not returned, not stored in
// recoverable form), a one-time setup link delivered only through
// EmailOutbox (ACCOUNT_SETUP), and an audit log row.

import { randomBytes, randomUUID } from "node:crypto";

import { normalizeAdminEmail } from "@/features/auth/contracts";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";

type AccountSpec = {
  email: string;
  deptCode: string;
  /**
   * `pj.medbrand.fixture@sekolah.local` is a local/synthetic address, not
   * a real inbox - per the request, the account is still created (so it
   * behaves identically to every other PJ account) but no ACCOUNT_SETUP
   * email is queued for it.
   */
  skipEmail?: true;
};

// Executive track (Track.EXECUTIVE departments in prisma/seed.ts).
const EXECUTIVE_ACCOUNTS: AccountSpec[] = [
  { email: "muhammadsyauqi@apps.ipb.ac.id", deptCode: "RISTEK" },
  { email: "ninasalamah@apps.ipb.ac.id", deptCode: "INTERNAL" },
  { email: "irfanmaulanaarsyad@apps.ipb.ac.id", deptCode: "KOMIT" },
  { email: "pj.medbrand.fixture@sekolah.local", deptCode: "MEDBRAND", skipEmail: true },
  { email: "ppeelliili@apps.ipb.ac.id", deptCode: "PSDM" },
  { email: "zhillanfarrel@apps.ipb.ac.id", deptCode: "ADKESMAH" },
  { email: "febriandewo@apps.ipb.ac.id", deptCode: "SLH" },
  { email: "veronikafany@apps.ipb.ac.id", deptCode: "EKRAF" },
  { email: "dandyfarelkenedy@apps.ipb.ac.id", deptCode: "SENBUD" },
  { email: "ayyitsciaasasikirana@apps.ipb.ac.id", deptCode: "KASTRAT" },
  { email: "almanurkamila@apps.ipb.ac.id", deptCode: "AKPRES" },
  { email: "naufaladika@apps.ipb.ac.id", deptCode: "PERAGA" },
];

// Legislative track (Track.LEGISLATIVE departments in prisma/seed.ts).
const LEGISLATIVE_ACCOUNTS: AccountSpec[] = [
  { email: "nurulazkiya@apps.ipb.ac.id", deptCode: "KOMLEG" },
  { email: "muhammadravadio@apps.ipb.ac.id", deptCode: "KOMPENG" },
  { email: "camseezamafaaza@apps.ipb.ac.id", deptCode: "KOMANGG" },
  { email: "fawwazbasyarahil@apps.ipb.ac.id", deptCode: "BADINTEKST" },
  { email: "erlgaaapraditiya@apps.ipb.ac.id", deptCode: "BADMEDBRND" },
];

const ACCOUNTS: AccountSpec[] = [...EXECUTIVE_ACCOUNTS, ...LEGISLATIVE_ACCOUNTS];

type Outcome =
  | { status: "created"; email: string; deptCode: string; emailSent: boolean }
  | { status: "already_exists"; email: string; deptCode: string }
  | { status: "department_not_found"; email: string; deptCode: string }
  | { status: "failed"; email: string; deptCode: string; error: string };

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

  console.log(`Memproses ${ACCOUNTS.length} akun PJ...\n`);
  const outcomes: Outcome[] = [];

  for (const account of ACCOUNTS) {
    const email = normalizeAdminEmail(account.email);
    try {
      // Same active-department guard as createPjAccount().
      const department = await prisma.department.findFirst({
        where: { code: account.deptCode, isActive: true },
      });
      if (!department) {
        outcomes.push({ status: "department_not_found", email, deptCode: account.deptCode });
        console.log(`  SKIP  dept "${account.deptCode}" tidak ditemukan/tidak aktif  -  ${email}`);
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        outcomes.push({ status: "already_exists", email, deptCode: account.deptCode });
        console.log(`  SKIP  akun sudah ada  -  ${email}`);
        continue;
      }

      const userId = randomUUID();
      const name = `PJ ${department.name}`;
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
            role: "DEPT_PJ",
            departmentId: department.id,
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
        if (!account.skipEmail) {
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
        }
        await tx.auditLog.create({
          data: {
            actorUserId: superAdmin.id,
            action: "CREATE",
            entityType: "ACCOUNT",
            entityId: userId,
            departmentId: department.id,
            afterJson: {
              role: "DEPT_PJ",
              departmentId: department.id,
              source: "scripts/create-pj-accounts.ts",
            },
            requestId: randomUUID(),
            reason: "bulk-provision-script",
          },
        });
      });

      outcomes.push({ status: "created", email, deptCode: account.deptCode, emailSent: !account.skipEmail });
      console.log(
        `  OK    ${email}  ->  ${department.name}${account.skipEmail ? " (email setup DILEWATI, sesuai permintaan)" : " (email setup terkirim ke outbox)"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ status: "failed", email, deptCode: account.deptCode, error: message });
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
    for (const o of alreadyExists) console.log(`  - ${o.email} (${o.deptCode})`);
  }
  if (deptNotFound.length > 0) {
    console.log("\nDept tidak ditemukan/tidak aktif:");
    for (const o of deptNotFound) console.log(`  - ${o.email} (${o.deptCode})`);
  }
  if (failed.length > 0) {
    console.log("\nGagal:");
    for (const o of failed) console.log(`  - ${o.email} (${o.deptCode}): ${o.error}`);
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
