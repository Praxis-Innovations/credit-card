import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { OpenAppLink } from "@/components/open-app-link";
import { CONTAINER } from "@/lib/styles";

export function SiteHeader() {
  return (
    <header
      className={`${CONTAINER} flex h-[68px] items-center justify-between md:h-20 lg:h-[88px]`}
    >
      <Link
        href="/"
        className="flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <BrandLogo />
      </Link>
      <OpenAppLink />
    </header>
  );
}
