import type { Metadata } from "next";

const productionOrigin = "https://sekolah.ormawaeksekutifpku.com";

export function createPublicMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = new URL(path, productionOrigin).toString();

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: "Sekolah Ormawa Eksekutif PKU",
      title,
      description,
      url: canonical,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Sekolah Ormawa Eksekutif PKU - Angkatan 63",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
