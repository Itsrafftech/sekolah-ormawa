import { GENERIC_RESET_REQUEST_MESSAGE } from "@/features/auth/contracts";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { processEmailOutbox } from "@/server/email/outbox";
import { noStoreJson } from "@/server/auth/http";
import { requestPasswordReset } from "@/server/auth/password-lifecycle";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const body = await readJsonObject(request);
    const result = await requestPasswordReset({
      headers: request.headers,
      email: typeof body.email === "string" ? body.email : "",
    });
    if (result.queued) {
      try {
        await processEmailOutbox({ limit: 1 });
      } catch {
        // Outbox tetap retryable; response generik tidak mengungkap status akun/provider.
      }
    }
    return noStoreJson({ data: { message: GENERIC_RESET_REQUEST_MESSAGE }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}

