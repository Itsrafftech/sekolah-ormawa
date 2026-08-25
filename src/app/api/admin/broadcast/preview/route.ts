import { validateBroadcastPreviewRequest } from "@/features/broadcast/validation";
import { previewBroadcast } from "@/server/broadcast/broadcast";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const parsed = validateBroadcastPreviewRequest(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data broadcast tidak valid.", fields: parsed.errors } }, 400);
    }

    const preview = await previewBroadcast(parsed.data);
    return noStoreJson({ data: preview, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
