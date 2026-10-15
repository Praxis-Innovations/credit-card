import { CATEGORY_PAGES, getCategoryPage } from "@/lib/category-pages";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageAlt, renderOgImage } from "@/lib/og-image";

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return CATEGORY_PAGES.map((page) => ({ category: page.id }));
}

/** One image per page, so each gets alt text naming its own h1. */
export function generateImageMetadata({ params }: { params: Params }) {
  const page = getCategoryPage(params.category);
  return [
    {
      id: "og",
      alt: page ? ogImageAlt(page.h1) : "NorthTap logo",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

export default function Image({ params }: { params: Params }) {
  const page = getCategoryPage(params.category);
  return renderOgImage(page?.h1 ?? "The right card for every purchase.");
}
