import { listPeriods } from "@/server/admin/periods";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);
    const periods = await listPeriods();
    return noStoreJson({ data: { periods }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
