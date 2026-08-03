import "server-only";

import { GENERIC_LOGIN_ERROR, normalizeAdminEmail, sanitizeAdminRedirect } from "@/features/auth/contracts";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security/crypto";
import { writeAuthAudit } from "@/server/auth/audit";
import { AuthServiceError } from "@/server/auth/errors";
import { callInternalAuth, noStoreJson } from "@/server/auth/http";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { clientIpHash } from "@/server/auth/security";

type InternalSignInResult = {
  token?: string;
  user?: { id?: string };
};

async function safeJson(response: Response): Promise<InternalSignInResult> {
  try {
    return await response.clone().json() as InternalSignInResult;
  } catch {
    return {};
  }
}

export async function performLogin(input: {
  headers: Headers;
  email: string;
  password: string;
  redirectTo?: unknown;
  now?: Date;
}): Promise<Response> {
  const now = input.now ?? new Date();
  const email = normalizeAdminEmail(input.email);
  const ipHash = clientIpHash(input.headers);
  await consumeAuthRateLimit({ scope: "LOGIN", identity: email, ipHash, now });

  const authResponse = await callInternalAuth("/sign-in/email", input.headers, {
    email,
    password: input.password,
    rememberMe: false,
  });
  const result = await safeJson(authResponse);
  const user = result.user?.id
    ? await prisma.user.findUnique({
        where: { id: result.user.id },
        select: {
          id: true,
          role: true,
          departmentId: true,
          isActive: true,
          banned: true,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: true,
        },
      })
    : null;

  const unavailable = !authResponse.ok || !result.token || !user || !user.isActive || user.banned;
  const temporaryExpired = Boolean(
    user?.mustChangePassword &&
    user.temporaryPasswordExpiresAt &&
    user.temporaryPasswordExpiresAt <= now,
  );
  if (unavailable || temporaryExpired) {
    if (result.token) await prisma.session.deleteMany({ where: { token: result.token } });
    await writeAuthAudit({
      action: "LOGIN_DENIED",
      headers: input.headers,
      actorUserId: user?.id ?? null,
      entityId: user?.id ?? sha256(email),
      reason: temporaryExpired
        ? "temporary-password-expired"
        : user && (!user.isActive || user.banned) ? "account-unavailable" : "invalid-credentials",
    });
    throw new AuthServiceError("INVALID_CREDENTIALS", 401, GENERIC_LOGIN_ERROR);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  await writeAuthAudit({
    action: "LOGIN",
    headers: input.headers,
    actorUserId: user.id,
    entityId: user.id,
    afterJson: { role: user.role, hasDepartmentScope: Boolean(user.departmentId) },
  });
  return noStoreJson({
    data: {
      next: user.mustChangePassword
        ? "/admin/ganti-password"
        : sanitizeAdminRedirect(input.redirectTo),
    },
    error: null,
  }, 200, authResponse.headers);
}
