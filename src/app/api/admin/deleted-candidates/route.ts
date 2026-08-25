import { listDeletedCandidates } from "@/server/admin/candidate-admin";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);
    const candidates = await listDeletedCandidates();
    return noStoreJson({ data: { candidates }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
