import { validateCreateAccount } from "@/features/admin/account-validation";
import { AccountAdminError, createPjAccount, listAccounts } from "@/server/admin/accounts";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

function accountErrorResponse(error: unknown): Response | null {
  if (error instanceof AccountAdminError) {
    return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);
    const accounts = await listAccounts();
    return noStoreJson({ data: { accounts }, error: null });
  } catch (error) {
    return accountErrorResponse(error) ?? authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const body = await readJsonObject(request);
    const parsed = validateCreateAccount(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data akun tidak valid.", fields: parsed.errors } }, 400);
    }

    const account = await createPjAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      departmentId: parsed.data.departmentId,
      actorUserId: context.userId,
      headers: request.headers,
    });
    return noStoreJson({ data: account, error: null }, 201);
  } catch (error) {
    return accountErrorResponse(error) ?? authErrorResponse(error);
  }
}
