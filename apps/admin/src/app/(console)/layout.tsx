import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { requireConsoleSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { email, role } = await requireConsoleSession();
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-teal px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar email={email} role={role} />
      <main
        id="main"
        tabIndex={-1}
        className="flex w-full max-w-[1240px] min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-12 focus:outline-none sm:px-6 lg:px-10 lg:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
