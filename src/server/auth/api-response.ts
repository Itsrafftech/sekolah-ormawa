import { AuthServiceError } from "@/server/auth/errors";
import { noStoreJson } from "@/server/auth/http";

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthServiceError) {
    return noStoreJson({
      data: null,
      error: { code: error.code, message: error.message },
    }, error.status);
  }
  // AuthServiceError (wrong password, rate limited, CSRF, scope, etc.) is
  // an expected, already-classified outcome handled above. Anything else
  // reaching here is unexpected (a thrown database/network error, a bug)
  // and previously fell straight to a generic 500 with zero server-side
  // trace - this is the shared error boundary for every admin API route
  // (33 call sites), so logging it here covers all of them at once. Logs
  // the error's own identity only (name/message/stack) - never the
  // request body, so credentials/PII are never at risk of being logged.
  console.error("[authErrorResponse] unhandled error:", error);
  return noStoreJson({
    data: null,
    error: { code: "AUTH_ERROR", message: "Permintaan autentikasi tidak dapat diproses." },
  }, 500);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json() as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

