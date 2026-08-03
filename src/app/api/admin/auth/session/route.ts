import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    return noStoreJson({
      data: {
        name: context.name,
        role: context.role,
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        mustChangePassword: context.mustChangePassword,
        permissions: context.permissions,
      },
      error: null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

