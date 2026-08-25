import { NextRequest, NextResponse } from "next/server";

import { AuthServiceError } from "@/server/auth/errors";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { assertValidCsrf, clientIpHash } from "@/server/auth/security";
import { processEmailOutbox } from "@/server/email/outbox";
import { readRegistrationOwner } from "@/server/registration/owner";
import {
  RegistrationSubmissionError,
  submitRegistration,
} from "@/server/registration/submit";

export async function POST(request: NextRequest) {
  try {
    assertValidCsrf(request);
  } catch (error) {
    const message = error instanceof AuthServiceError ? error.message : "Request state-changing tidak sah.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    await consumeAuthRateLimit({
      scope: "REGISTRATION_SUBMIT",
      identity: "public",
      ipHash: clientIpHash(request.headers),
      maximum: 10,
    });
  } catch {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan submit. Tunggu sebelum mencoba kembali." },
      { status: 429 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
  const ownerToken = readRegistrationOwner(request);
  if (!ownerToken) {
    return NextResponse.json(
      { error: "Sesi upload tidak tersedia. Unggah ulang dokumen." },
      { status: 401 },
    );
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON request tidak valid." }, { status: 400 });
  }

  try {
    const result = await submitRegistration({
      payload,
      idempotencyKey,
      ownerToken,
      requestId: request.headers.get("X-Request-Id") ?? undefined,
    });
    try {
      await processEmailOutbox({ limit: 1 });
    } catch {
      // Registration is already committed. The outbox remains retryable.
    }
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RegistrationSubmissionError) {
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Submission tidak dapat diproses. Coba kembali dengan kunci yang sama." },
      { status: 500 },
    );
  }
}
