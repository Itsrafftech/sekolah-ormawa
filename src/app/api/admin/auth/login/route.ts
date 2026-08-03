import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { performLogin } from "@/server/auth/login";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const body = await readJsonObject(request);
    return await performLogin({
      headers: request.headers,
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      redirectTo: body.redirectTo,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

