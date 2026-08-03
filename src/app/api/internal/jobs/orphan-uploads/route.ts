import { NextRequest, NextResponse } from "next/server";

import { authorizeInternalJob } from "@/server/jobs/authorize";
import { cleanupOrphanUploads } from "@/server/registration/uploads";

export async function POST(request: NextRequest) {
  if (!authorizeInternalJob(request.headers.get("Authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cleaned = await cleanupOrphanUploads();
  return NextResponse.json({ cleaned }, { headers: { "Cache-Control": "no-store" } });
}
