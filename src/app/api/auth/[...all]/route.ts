import { NextResponse } from "next/server";

// Better Auth tetap menjadi engine internal. Endpoint mentahnya tidak diekspos
// agar login, reset, audit, CSRF, dan forced-password policy tidak dapat dibypass.
function unavailable() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Endpoint tidak tersedia." } },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = unavailable;
export const POST = unavailable;
