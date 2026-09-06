import { NextResponse } from "next/server";

import { listDepartmentsByTrack } from "@/server/departments/public";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated department listing grouped by track (Phase A -
 * "Jalur Legislatif"): { executive: [...], legislative: [...] }. Backend
 * only for now - no page consumes this yet (the registration form keeps
 * using RegistrationFormConfig.departments, untouched this phase).
 */
export async function GET() {
  const departments = await listDepartmentsByTrack();
  return NextResponse.json(
    { data: departments, error: null },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
