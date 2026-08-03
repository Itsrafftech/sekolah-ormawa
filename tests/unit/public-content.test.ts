import { describe, expect, it } from "vitest";

import {
  PUBLIC_CONTENT_STATUS,
  publicSiteContent,
} from "@/content/public-site";

describe("public landing content", () => {
  it("menandai konten sementara sebagai DRAFT", () => {
    expect(PUBLIC_CONTENT_STATUS).toBe("DRAFT");
    expect(publicSiteContent.previewNotice).toContain("pratinjau");
  });

  it("tidak memakai lorem ipsum atau testimoni rekaan", () => {
    const serialized = JSON.stringify(publicSiteContent).toLowerCase();

    expect(serialized).not.toContain("lorem ipsum");
    expect(publicSiteContent.testimonials.every((item) => item.includes("akan") || item.includes("belum"))).toBe(true);
  });

  it("mendokumentasikan kewajiban portofolio Medbrand di FAQ", () => {
    const medbrandFaq = publicSiteContent.faq.find((item) =>
      item.question.includes("Media Branding"),
    );

    expect(medbrandFaq?.answer).toContain("Pilihan 1 atau Pilihan 2");
    expect(medbrandFaq?.answer).toContain("JPG/JPEG/PNG");
  });
});
