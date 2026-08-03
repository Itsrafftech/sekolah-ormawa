import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      data: {
        service: "sekolah-ormawa",
        status: "ok",
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
