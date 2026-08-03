import "server-only";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser, requirePasswordChanged } from "@/server/auth/guard";
import { AuthServiceError } from "@/server/auth/errors";

export async function requireAdminPage(options: { allowForcedPassword?: boolean } = {}) {
  try {
    const context = await requireAuthenticatedUser();
    return options.allowForcedPassword ? context : requirePasswordChanged(context);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      if (error.code === "PASSWORD_CHANGE_REQUIRED") redirect("/admin/ganti-password");
      if (error.code === "TEMPORARY_PASSWORD_EXPIRED") {
        redirect("/admin/lupa-password?reason=temporary-expired");
      }
      if (["UNAUTHENTICATED", "SESSION_EXPIRED", "SESSION_REVOKED"].includes(error.code)) {
        redirect(`/admin/login?reason=${error.code.toLowerCase()}`);
      }
    }
    redirect("/admin/tidak-berwenang");
  }
}

