import { validateUpdateAccount } from "@/features/admin/account-validation";
import { AccountAdminError, updateAccount } from "@/server/admin/accounts";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string }> };

function accountErrorResponse(error: unknown): Response | null {
  if (error instanceof AccountAdminError) {
    return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
  }
  return null;
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const body = await readJsonObject(request);
    const parsed = validateUpdateAccount(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data akun tidak valid.", fields: parsed.errors } }, 400);
    }

    const account = await updateAccount({
      accountId: id,
      name: parsed.data.name,
      departmentId: parsed.data.departmentId,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!account) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Akun PJ tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: account, error: null });
  } catch (error) {
    return accountErrorResponse(error) ?? authErrorResponse(error);
  }
}
