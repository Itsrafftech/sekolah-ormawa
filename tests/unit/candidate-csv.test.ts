import { describe, expect, it } from "vitest";

import { escapeCsvCell, toCsvRow } from "@/features/candidates/csv";

describe("escapeCsvCell", () => {
  it("meloloskan teks biasa apa adanya", () => {
    expect(escapeCsvCell("Ahmad Fixture")).toBe("Ahmad Fixture");
  });

  it("menetralkan awalan formula =+-@ dengan apostrof", () => {
    expect(escapeCsvCell("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell("-1+1")).toBe("'-1+1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("membungkus dengan tanda kutip ganda saat ada koma/kutip/baris baru", () => {
    expect(escapeCsvCell("Nama, dengan koma")).toBe('"Nama, dengan koma"');
    expect(escapeCsvCell('Nama "julukan"')).toBe('"Nama ""julukan"""');
    expect(escapeCsvCell("baris1\nbaris2")).toBe('"baris1\nbaris2"');
  });

  it("menggabungkan guard formula dan quoting saat keduanya diperlukan", () => {
    expect(escapeCsvCell("=A1,B1")).toBe('"\'=A1,B1"');
  });
});

describe("toCsvRow", () => {
  it("menggabungkan sel dengan koma", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("menerapkan escape per sel", () => {
    expect(toCsvRow(["Ahmad", "=1+1", "x,y"])).toBe('Ahmad,\'=1+1,"x,y"');
  });
});
