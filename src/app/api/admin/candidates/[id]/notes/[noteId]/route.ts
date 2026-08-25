import { validateNoteBody } from "@/features/candidates/validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { softDeleteDepartmentNote, updateDepartmentNote } from "@/server/candidates/notes";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id, noteId } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.note.manage.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const body = await readJsonObject(request);
    const parsed = validateNoteBody(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Catatan tidak valid.", fields: parsed.errors } }, 400);
    }

    const note = await updateDepartmentNote({
      noteId,
      candidateId: id,
      departmentId,
      body: parsed.data.body,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!note) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Catatan tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: note, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id, noteId } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.note.manage.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const removed = await softDeleteDepartmentNote({
      noteId,
      candidateId: id,
      departmentId,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!removed) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Catatan tidak ditemukan." } }, 404);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
