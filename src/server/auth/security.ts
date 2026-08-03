import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { getServerEnvironment } from "@/lib/env";
import { AuthServiceError } from "@/server/auth/errors";

export function requestIdFromHeaders(headers: Headers): string {
  const candidate = headers.get("x-request-id")?.trim();
  return candidate && candidate.length <= 100 ? candidate : randomUUID();
}

export function safeUserAgent(headers: Headers): string | null {
  const value = headers.get("user-agent")?.trim();
  return value ? value.slice(0, 240) : null;
}

export function clientIpHash(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", getServerEnvironment().IP_HASH_SECRET)
    .update(candidate)
    .digest("hex");
}

export function assertValidCsrf(
  request: Request,
  expectedOrigin = new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin,
): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || !origin) {
    throw new AuthServiceError("INVALID_CSRF", 403, "Request state-changing tidak sah.");
  }
  try {
    if (new URL(origin).origin !== expectedOrigin) {
      throw new AuthServiceError("INVALID_CSRF", 403, "Request state-changing tidak sah.");
    }
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError("INVALID_CSRF", 403, "Request state-changing tidak sah.");
  }
}
