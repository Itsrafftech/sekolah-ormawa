import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePasswordChanged } from "@/server/auth/guard";
import { revokeAllSessions } from "@/server/auth/session-actions";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = requirePasswordChanged(await requireAuthenticatedUser(request.headers));
    return await revokeAllSessions({ context, headers: request.headers });
  } catch (error) {
    return authErrorResponse(error);
  }
}

