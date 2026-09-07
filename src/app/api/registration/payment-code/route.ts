import { NextRequest, NextResponse } from "next/server";

import { getRegistrationAvailability } from "@/server/registration/config";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { clientIpHash } from "@/server/auth/security";

// "Guidebook, ketentuan, dan pembayaran": issues the 3-digit payment code
// a registrant sees on the Payment step. GET per the spec, but note this
// is NOT a side-effect-free GET in the usual REST sense - each call
// atomically burns one value from RecruitmentPeriod.paymentCodeSequence
// (same single-row UPDATE...increment pattern as registrationSequence in
// submit.ts). The client is responsible for calling this only once per
// draft (persisting the result to the localStorage draft) rather than
// re-fetching on every visit to the step - see registration-form.tsx.
//
// Deliberately does NOT call assertValidCsrf() like the sibling POST
// routes in this directory: that check requires an `Origin` header to be
// present and rejects the request otherwise, which is reliable for
// "unsafe" methods (POST/PATCH/DELETE) but NOT for a same-origin GET
// fetch() - browsers are not required to send Origin on those, so
// applying the same check here would risk rejecting the legitimate
// caller. There is also no cookie/session-based ambient authority for a
// forged cross-site request to ride on (this endpoint is fully
// unauthenticated). The real risk this endpoint has - abuse exhausting
// the 3-digit code space - is instead mitigated by the rate limit below
// plus requiring periodId to match the currently OPEN period.
export async function GET(request: NextRequest) {
  try {
    await consumeAuthRateLimit({
      scope: "REGISTRATION_PAYMENT_CODE",
      identity: "public",
      ipHash: clientIpHash(request.headers),
      maximum: 20,
    });
  } catch {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Tunggu sebelum mencoba kembali." },
      { status: 429 },
    );
  }

  const periodId = request.nextUrl.searchParams.get("periodId");
  const availability = await getRegistrationAvailability();
  if (availability.state !== "OPEN" || periodId !== availability.config.periodId) {
    return NextResponse.json({ error: availability.state === "OPEN" ? "Periode tidak valid." : availability.detail }, { status: 409 });
  }

  const environment = getServerEnvironment();
  const { paymentCodeSequence } = await prisma.recruitmentPeriod.update({
    where: { id: periodId },
    data: { paymentCodeSequence: { increment: 1 } },
    select: { paymentCodeSequence: true },
  });
  // Zero-padded to (at least) 3 digits per the spec's format. Not capped
  // at 999 - a period with over 999 registrants still gets a unique,
  // correctly-computed 4+-digit code rather than failing registration;
  // this is a known, deliberate deviation from the literal "3 digit"
  // wording, flagged in the phase report.
  const code = String(paymentCodeSequence).padStart(3, "0");
  const amount = environment.PAYMENT_BASE_AMOUNT + paymentCodeSequence;

  return NextResponse.json(
    { code, amount },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
