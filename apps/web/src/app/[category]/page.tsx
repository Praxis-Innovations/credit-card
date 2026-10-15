import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPageView } from "@/components/category-page";
import {
  CATEGORY_PAGES,
  getCategoryPage,
  getCategoryPageData,
} from "@/lib/category-pages";
import { pageMetadata } from "@/lib/metadata";
import { CATEGORY_PAGES_INDEXABLE } from "@/lib/site";

type Props = { params: Promise<{ category: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_PAGES.map((page) => ({ category: page.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getCategoryPage((await params).category);
  if (!page) return {};
  return pageMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    indexable: CATEGORY_PAGES_INDEXABLE,
  });
}

export default async function CategoryRoute({ params }: Props) {
  const page = getCategoryPage((await params).category);
  if (!page) notFound();
  return <CategoryPageView data={getCategoryPageData(page)} />;
}
