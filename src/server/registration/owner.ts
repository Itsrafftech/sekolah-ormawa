import { randomBytes } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

export const REGISTRATION_OWNER_COOKIE = "sekolah_registration_owner";

export function readRegistrationOwner(request: NextRequest): string | null {
  return request.cookies.get(REGISTRATION_OWNER_COOKIE)?.value ?? null;
}

export function ensureRegistrationOwner(request: NextRequest): {
  token: string;
  created: boolean;
} {
  const existing = readRegistrationOwner(request);
  return existing
    ? { token: existing, created: false }
    : { token: randomBytes(32).toString("base64url"), created: true };
}

export function attachRegistrationOwner(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(REGISTRATION_OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}
