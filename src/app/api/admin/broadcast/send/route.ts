import { validateBroadcastSendRequest } from "@/features/broadcast/validation";
import { BroadcastError, sendBroadcast } from "@/server/broadcast/broadcast";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { assertValidCsrf, clientIpHash } from "@/server/auth/security";
import { noStoreJson } from "@/server/auth/http";

export async function POST(request: Request) {
  try {
    assertValidCsrf(request);
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.broadcast.send", request.headers);
    await consumeAuthRateLimit({
      scope: "ADMIN_BROADCAST_SEND",
      identity: context.userId,
      ipHash: clientIpHash(request.headers),
      maximum: 5,
    });

    const parsed = validateBroadcastSendRequest(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data broadcast tidak valid.", fields: parsed.errors } }, 400);
    }

    const result = await sendBroadcast({
      filter: parsed.data.filter,
      content: parsed.data.content,
      previewToken: parsed.data.previewToken,
      actorUserId: context.userId,
      headers: request.headers,
    });
    return noStoreJson({ data: result, error: null });
  } catch (error) {
    if (error instanceof BroadcastError) {
      return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
    }
    return authErrorResponse(error);
  }
}
