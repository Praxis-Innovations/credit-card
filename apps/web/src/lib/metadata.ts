import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * Full per-page metadata. Pages set their own openGraph/twitter because Next
 * replaces (not merges) those objects from the layout. OG images come from the
 * opengraph-image file convention next to each route.
 */
export function pageMetadata({
  title,
  description,
  path,
  indexable = true,
}: {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: indexable, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_CA",
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
