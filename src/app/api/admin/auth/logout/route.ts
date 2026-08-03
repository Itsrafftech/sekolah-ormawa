import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser } from "@/server/auth/guard";
import { logoutCurrentSession } from "@/server/auth/session-actions";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = await requireAuthenticatedUser(request.headers);
    return await logoutCurrentSession({ context, headers: request.headers });
  } catch (error) {
    return authErrorResponse(error);
  }
}

