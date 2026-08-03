import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser } from "@/server/auth/guard";
import { changeAuthenticatedPassword } from "@/server/auth/password-lifecycle";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = await requireAuthenticatedUser(request.headers);
    const body = await readJsonObject(request);
    return await changeAuthenticatedPassword({
      context,
      headers: request.headers,
      currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

