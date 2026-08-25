import { issueAccountResetLink } from "@/server/admin/accounts";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const issued = await issueAccountResetLink({
      accountId: id,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!issued) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Akun PJ tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: { issued: true }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
