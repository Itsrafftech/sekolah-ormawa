import { validateNoteBody } from "@/features/candidates/validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { createDepartmentNote, listDepartmentNotes } from "@/server/candidates/notes";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.note.manage.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const notes = await listDepartmentNotes(id, departmentId);
    if (notes === null) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Kandidat tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: { notes }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.note.manage.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const body = await readJsonObject(request);
    const parsed = validateNoteBody(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Catatan tidak valid.", fields: parsed.errors } }, 400);
    }

    const note = await createDepartmentNote({
      candidateId: id,
      departmentId,
      body: parsed.data.body,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!note) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Kandidat tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: note, error: null }, 201);
  } catch (error) {
    return authErrorResponse(error);
  }
}
