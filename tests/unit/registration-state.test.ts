import { describe, expect, it } from "vitest";

import { resolveRegistrationState } from "@/lib/public/registration-state";

const now = new Date("2026-08-01T12:00:00.000Z");
const basePeriod = {
  name: "Periode Fixture",
  cohortCode: 63,
  opensAt: new Date("2026-07-01T00:00:00.000Z"),
  closesAt: new Date("2026-09-01T00:00:00.000Z"),
} as const;

describe("public registration state", () => {
  it("tidak membuka CTA untuk periode DRAFT", () => {
    const registration = resolveRegistrationState(
      { ...basePeriod, status: "DRAFT", configStatus: "DRAFT" },
      now,
    );

    expect(registration.state).toBe("UPCOMING");
    expect(registration.href).toBeNull();
  });

  it("tidak membuka CTA untuk periode CLOSED", () => {
    const registration = resolveRegistrationState(
      { ...basePeriod, status: "CLOSED", configStatus: "ACTIVE" },
      now,
    );

    expect(registration.state).toBe("CLOSED");
    expect(registration.href).toBeNull();
  });

  it("tidak membuka CTA sebelum waktu mulai", () => {
    const registration = resolveRegistrationState(
      {
        ...basePeriod,
        status: "OPEN",
        configStatus: "ACTIVE",
        opensAt: new Date("2026-08-02T00:00:00.000Z"),
      },
      now,
    );

    expect(registration.state).toBe("UPCOMING");
    expect(registration.href).toBeNull();
  });

  it("membuka CTA hanya untuk periode aktif dalam rentang waktu", () => {
    const registration = resolveRegistrationState(
      { ...basePeriod, status: "OPEN", configStatus: "ACTIVE" },
      now,
    );

    expect(registration.state).toBe("OPEN");
    expect(registration.href).toBe("/daftar");
  });
});
