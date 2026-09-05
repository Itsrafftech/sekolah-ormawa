import { describe, expect, it } from "vitest";

import {
  validateSelectionActionInput,
  validateSelectionAdminActionInput,
} from "@/features/candidates/selection-validation";

describe("validateSelectionActionInput (aksi PJ: ambil/ragu-ragu/alihkan/gugurkan)", () => {
  it("menerima payload tanpa reason sama sekali (opsional)", () => {
    const result = validateSelectionActionInput({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reason).toBeUndefined();
  });

  it("menerima reason kosong sebagai opsional", () => {
    const result = validateSelectionActionInput({ reason: "" });
    expect(result.success).toBe(true);
  });

  it("menerima reason valid dan trims whitespace", () => {
    const result = validateSelectionActionInput({ reason: "  Kandidat sangat sesuai.  " });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reason).toBe("Kandidat sangat sesuai.");
  });

  it("menolak reason di atas 500 karakter", () => {
    const result = validateSelectionActionInput({ reason: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe("validateSelectionAdminActionInput (reset/restore Super Admin)", () => {
  it("menolak payload tanpa reason - wajib untuk aksi admin", () => {
    expect(validateSelectionAdminActionInput({}).success).toBe(false);
  });

  it("menolak reason kosong", () => {
    expect(validateSelectionAdminActionInput({ reason: "" }).success).toBe(false);
  });

  it("menolak reason di bawah 5 karakter", () => {
    expect(validateSelectionAdminActionInput({ reason: "abcd" }).success).toBe(false);
  });

  it("menolak reason di atas 500 karakter", () => {
    expect(validateSelectionAdminActionInput({ reason: "a".repeat(501) }).success).toBe(false);
  });

  it("menerima reason valid dan trims whitespace", () => {
    const result = validateSelectionAdminActionInput({ reason: "  Override oleh Super Admin.  " });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reason).toBe("Override oleh Super Admin.");
  });
});
