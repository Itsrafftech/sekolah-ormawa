import type { MetadataRoute } from "next";

const origin = "https://sekolah.ormawaeksekutifpku.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/tentang", "/departemen", "/faq", "/kebijakan-privasi"].map(
    (path) => ({
      url: `${origin}${path}`,
      lastModified: new Date("2026-08-01T00:00:00+07:00"),
      changeFrequency: path === "" ? "weekly" : "monthly",
      priority: path === "" ? 1 : 0.7,
    }),
  );
}
