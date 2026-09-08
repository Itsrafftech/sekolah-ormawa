// One-off provisioning script for a single new KETUA_PELAKSANA account
// (23hanafarhanah@apps.ipb.ac.id). Safe to re-run (idempotent): an email
// that already has a User row is skipped and reported, never duplicated
// or overwritten.
//
// Run with (DATABASE_URL read from the environment - never hardcoded here):
//   npx tsx scripts/create-ketua-pelaksana-account.ts
//
// Prerequisite: `prisma db seed` must already have run - this script needs
// (1) an existing SUPER_ADMIN user to attribute the audit log row to, and
// (2) the KETUA_PELAKSANA role row (added to prisma/seed.ts's
// roleFixtures, ADR-049) to already exist, since users.role is a foreign
// key to roles.code.
//
// Why this duplicates createPjAccount() (src/server/admin/accounts.ts)
// instead of importing it, and why it's a NEW file rather than editing
// scripts/create-additional-accounts.ts: identical reasoning to both of
// those scripts' own headers - every module under src/server/** starts
// with `import "server-only"`, which throws under a plain tsx/Node import
// path, and "jangan ubah kode apapun" for this request specifically rules
// out touching the already-committed create-additional-accounts.ts (which
// has its own two, already-provisioned accounts hardcoded) - only
// genuinely server-only-free leaf modules are imported below, and the
// account-creation transaction mirrors createPjAccount()'s fields exactly
// (mustChangePassword: true, a throwaway random password hash never
// surfaced anywhere, a one-time setup link delivered only through
// EmailOutbox ACCOUNT_SETUP, and an audit log row), generalized for a
// departmentless KETUA_PELAKSANA account the same way
// create-additional-accounts.ts already did.

import { randomBytes, randomUUID } from "node:crypto";

import { normalizeAdminEmail } from "@/features/auth/contracts";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";

const ACCOUNT = {
  email: "23hanafarhanah@apps.ipb.ac.id",
  name: "Ketua Pelaksana",
} as const;

async function main() {
  const environment = getServerEnvironment();
  const now = new Date();
  const email = normalizeAdminEmail(ACCOUNT.email);

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`SKIP  akun sudah ada  -  ${email} (role: ${existing.role})`);
    return;
  }

  const userId = randomUUID();
  // Throwaway hash, immediately discarded after this line - nobody,
  // including whoever runs this script, ever sees a usable initial
  // password. The account only becomes usable through the one-time setup
  // link below.
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
        name: ACCOUNT.name,
        email,
        emailVerified: false,
        role: "KETUA_PELAKSANA",
        departmentId: null,
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
            recipientName: ACCOUNT.name,
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
        departmentId: null,
        afterJson: {
          role: "KETUA_PELAKSANA",
          departmentId: null,
          source: "scripts/create-ketua-pelaksana-account.ts",
        },
        requestId: randomUUID(),
        reason: "bulk-provision-script",
      },
    });
  });

  console.log(`OK    ${email}  ->  KETUA_PELAKSANA (email setup terkirim ke outbox)`);
}

main()
  .catch((error) => {
    console.error("Script gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
