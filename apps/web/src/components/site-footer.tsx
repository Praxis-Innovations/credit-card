import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { CONTAINER } from "@/lib/styles";

/** The rule is full-bleed on phones and inset to the content width from md. */
export function SiteFooter() {
  return (
    <footer className="border-t border-divider md:border-t-0">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-6 pt-6 pb-8 text-[13px] text-muted md:flex-row md:items-start md:justify-between md:border-t md:border-divider md:pt-8 md:pb-10 md:text-sm">
          <div className="flex flex-col gap-1.5">
            <p className="flex">
              <BrandLogo size="sm" />
            </p>
            <p>Not financial advice. Confirm rates with your issuer.</p>
          </div>
          <nav aria-labelledby="footer-categories">
            <h2
              id="footer-categories"
              className="font-semibold text-foreground"
            >
              Categories
            </h2>
            <ul className="mt-1 flex flex-wrap gap-x-5 md:flex-col md:gap-y-1">
              {CATEGORY_PAGES.map((page) => (
                <li key={page.id}>
                  <Link
                    href={page.path}
                    className="inline-flex min-h-6 items-center rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Best card for {page.label.toLowerCase()}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
