import { z } from "zod";

import { setAccountBanned } from "@/server/admin/accounts";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ banned: z.boolean() });

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const parsed = bodySchema.safeParse(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Field banned wajib boolean." } }, 400);
    }

    const account = await setAccountBanned({
      accountId: id,
      banned: parsed.data.banned,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!account) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Akun PJ tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: account, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
