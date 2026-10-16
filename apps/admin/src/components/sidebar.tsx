"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { ROLE_LABELS, type AdminRole } from "@/lib/auth/roles";
import { BrandLogo } from "./brand-logo";

const NAV_ITEMS = [
  { label: "Review queue", href: "/review" },
  { label: "Cards", href: null },
  { label: "Sources", href: "/sources" },
  { label: "Crawl", href: "/crawl" },
] as const;

const itemBase =
  "relative flex min-h-10 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-[15px] lg:min-h-11";

export function Sidebar({ email, role }: { email: string; role: AdminRole }) {
  const current = usePathname();
  return (
    <aside className="flex flex-col gap-4 border-b border-line bg-surface px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-[264px] lg:shrink-0 lg:gap-7 lg:border-r lg:border-b-0 lg:py-6">
      <div className="px-2">
        <BrandLogo />
      </div>

      <nav aria-label="Admin">
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={
                    current === item.href || current.startsWith(`${item.href}/`) ? "page" : undefined
                  }
                  className={`${itemBase} font-semibold no-underline aria-[current=page]:bg-teal-soft aria-[current=page]:text-teal`}
                >
                  {item.label}
                </Link>
              </li>
            ) : (
              <li key={item.label}>
                <span
                  aria-disabled="true"
                  title="Coming soon"
                  className={`${itemBase} cursor-not-allowed font-medium text-muted`}
                >
                  {item.label}
                  <span className="sr-only lg:not-sr-only lg:rounded-full lg:bg-line-soft lg:px-2 lg:py-0.5 lg:text-[11px] lg:font-semibold lg:text-neutral-fg">
                    Coming soon
                  </span>
                </span>
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-2 pt-3 text-[13px] text-body lg:mt-auto lg:flex-col lg:items-stretch lg:p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold text-ink">Signed in with Google</span>
          <span className="truncate" title={email}>
            {email}
          </span>
          <span>Role: {ROLE_LABELS[role]}</span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="h-9 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft lg:w-full"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
