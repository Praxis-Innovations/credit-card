import Link from "next/link";
import { OpenAppLink } from "@/components/open-app-link";
import { CONTAINER } from "@/lib/styles";

export function SiteHeader() {
  return (
    <header
      className={`${CONTAINER} flex h-[68px] items-center justify-between md:h-20 lg:h-[88px]`}
    >
      <Link
        href="/"
        className="font-display text-xl font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:text-[22px]"
      >
        NorthTap
      </Link>
      <OpenAppLink />
    </header>
  );
}
