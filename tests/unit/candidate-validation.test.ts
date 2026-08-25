import { describe, expect, it } from "vitest";

import { parseCandidateListQuery, validateNoteBody } from "@/features/candidates/validation";

describe("parseCandidateListQuery", () => {
  it("menerima segment valid dan memakai default sort/limit", () => {
    const result = parseCandidateListQuery(new URLSearchParams({ segment: "PRIMARY" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      segment: "PRIMARY",
      search: null,
      cursor: null,
      limit: 20,
      sort: "submittedAt_asc",
      departmentId: null,
    });
  });

  it("menolak segment di luar whitelist", () => {
    const result = parseCandidateListQuery(new URLSearchParams({ segment: "UNKNOWN" }));
    expect(result.success).toBe(false);
  });

  it("menolak segment yang tidak diisi", () => {
    const result = parseCandidateListQuery(new URLSearchParams({}));
    expect(result.success).toBe(false);
  });

  it("menolak sort di luar whitelist", () => {
    const result = parseCandidateListQuery(
      new URLSearchParams({ segment: "PRIMARY", sort: "gpa_desc" }),
    );
    expect(result.success).toBe(false);
  });

  it("menolak cursor yang bukan UUID", () => {
    const result = parseCandidateListQuery(
      new URLSearchParams({ segment: "PRIMARY", cursor: "not-a-uuid" }),
    );
    expect(result.success).toBe(false);
  });

  it("membatasi limit maksimum 50", () => {
    const result = parseCandidateListQuery(
      new URLSearchParams({ segment: "PRIMARY", limit: "500" }),
    );
    expect(result.success).toBe(false);
  });

  it("mengosongkan search string kosong menjadi null", () => {
    const result = parseCandidateListQuery(
      new URLSearchParams({ segment: "SECONDARY", search: "   " }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.search).toBeNull();
  });
});

describe("validateNoteBody", () => {
  it("menolak body kosong setelah trim", () => {
    const result = validateNoteBody({ body: "   " });
    expect(result.success).toBe(false);
  });

  it("menolak body lebih dari 2000 karakter", () => {
    const result = validateNoteBody({ body: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("menerima body valid dan trims whitespace", () => {
    const result = validateNoteBody({ body: "  Catatan evaluasi.  " });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.body).toBe("Catatan evaluasi.");
  });

  it("menolak payload tanpa field body", () => {
    const result = validateNoteBody({});
    expect(result.success).toBe(false);
  });
});
