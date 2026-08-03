import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getServerEnvironment } from "@/lib/env";

export function authorizeInternalJob(authorization: string | null): boolean {
  const secret = getServerEnvironment().CRON_SECRET;
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
