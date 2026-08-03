import { NextRequest, NextResponse } from "next/server";

import { processEmailOutbox } from "@/server/email/outbox";
import { authorizeInternalJob } from "@/server/jobs/authorize";

export async function POST(request: NextRequest) {
  if (!authorizeInternalJob(request.headers.get("Authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processEmailOutbox({ limit: 25 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
