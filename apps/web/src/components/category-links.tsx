import Link from "next/link";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { CONTAINER, SECTION, SECTION_HEADING } from "@/lib/styles";

/** Home page "Best card by category" row linking the category pages. */
export function CategoryLinks() {
  return (
    <section aria-labelledby="categories-heading" className={CONTAINER}>
      <div className={SECTION}>
        <h2 id="categories-heading" className={SECTION_HEADING}>
          Best card by category
        </h2>
        <ul className="grid gap-3 md:grid-cols-3 md:gap-6">
          {CATEGORY_PAGES.map((page) => (
            <li key={page.id}>
              <Link
                href={page.path}
                className="group flex h-full items-center justify-between gap-4 rounded-2xl border border-divider bg-surface p-5 transition-colors hover:border-highlight-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:p-6"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-display text-[19px] font-semibold text-foreground md:text-xl">
                    {page.label}
                  </span>
                  <span className="text-[15px] leading-[1.5] text-body">
                    Which credit card to use {page.onNoun}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-xl text-accent transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
