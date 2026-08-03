import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { noStoreJson } from "@/server/auth/http";
import { resetPasswordWithToken } from "@/server/auth/password-lifecycle";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const body = await readJsonObject(request);
    await resetPasswordWithToken({
      headers: request.headers,
      token: typeof body.token === "string" ? body.token : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
    });
    return noStoreJson({
      data: { next: "/admin/login?reason=reset-success" },
      error: null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

