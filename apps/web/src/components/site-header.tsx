import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { OpenAppLink } from "@/components/open-app-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { CONTAINER } from "@/lib/styles";

export function SiteHeader() {
  return (
    <header
      className={`${CONTAINER} flex h-(--header-h) items-center justify-between`}
    >
      <Link
        href="/"
        className="flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <BrandLogo />
      </Link>
      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        <OpenAppLink />
      </div>
    </header>
  );
}
