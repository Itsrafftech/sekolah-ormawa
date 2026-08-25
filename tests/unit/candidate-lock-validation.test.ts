import { describe, expect, it } from "vitest";

import {
  validateLockInput,
  validatePlacementInput,
  validateUnlockInput,
} from "@/features/candidates/lock-validation";

describe("validateLockInput / validateUnlockInput", () => {
  it("menolak reason kosong", () => {
    expect(validateLockInput({ reason: "" }).success).toBe(false);
    expect(validateUnlockInput({ reason: "" }).success).toBe(false);
  });

  it("menolak reason di bawah 5 karakter", () => {
    const result = validateLockInput({ reason: "abcd" });
    expect(result.success).toBe(false);
  });

  it("menolak reason di atas 500 karakter", () => {
    const result = validateLockInput({ reason: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("menolak payload tanpa field reason", () => {
    expect(validateLockInput({}).success).toBe(false);
  });

  it("menerima reason valid dan trims whitespace", () => {
    const result = validateLockInput({ reason: "  Kandidat sangat sesuai kebutuhan tim.  " });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reason).toBe("Kandidat sangat sesuai kebutuhan tim.");
  });
});

describe("validatePlacementInput", () => {
  it("menolak status di luar whitelist", () => {
    const result = validatePlacementInput({ status: "APPROVED" });
    expect(result.success).toBe(false);
  });

  it("menerima status valid tanpa mentorLabel/reason", () => {
    const result = validatePlacementInput({ status: "PLACED" });
    expect(result.success).toBe(true);
  });

  it("menerima status valid dengan mentorLabel dan reason opsional", () => {
    const result = validatePlacementInput({
      status: "WAITLISTED",
      mentorLabel: "Mentor A",
      reason: "Kuota penuh untuk periode ini.",
    });
    expect(result.success).toBe(true);
  });
});
