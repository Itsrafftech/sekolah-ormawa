import { describe, expect, it } from "vitest";

import { publicSiteContent } from "@/content/public-site";

describe("public landing content", () => {
  it("tidak memakai lorem ipsum", () => {
    const serialized = JSON.stringify(publicSiteContent).toLowerCase();

    expect(serialized).not.toContain("lorem ipsum");
  });

  it("mendokumentasikan kewajiban portofolio Medbrand di FAQ", () => {
    const medbrandFaq = publicSiteContent.faq.find((item) =>
      item.question.includes("Media Branding"),
    );

    expect(medbrandFaq?.answer).toContain("Pilihan 1 atau Pilihan 2");
    expect(medbrandFaq?.answer).toContain("JPG/JPEG/PNG");
  });

  it("mengarahkan gabung grup peserta ke link undangan WhatsApp", () => {
    expect(publicSiteContent.contact.whatsappGroupUrl).toMatch(
      /^https:\/\/chat\.whatsapp\.com\//,
    );
  });
});
