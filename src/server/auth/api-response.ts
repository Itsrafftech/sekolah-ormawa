import { AuthServiceError } from "@/server/auth/errors";
import { noStoreJson } from "@/server/auth/http";

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthServiceError) {
    return noStoreJson({
      data: null,
      error: { code: error.code, message: error.message },
    }, error.status);
  }
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

