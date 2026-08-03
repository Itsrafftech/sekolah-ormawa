import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        data: {
          database: "ready",
          service: "sekolah-ormawa",
          status: "ready",
        },
        error: null,
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Layanan belum siap menerima trafik.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
