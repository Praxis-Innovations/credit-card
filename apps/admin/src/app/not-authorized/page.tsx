import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Not authorized" };

export default function NotAuthorizedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-line bg-surface p-8">
        <BrandLogo />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold">This account can&apos;t use the console</h1>
          <p className="text-[15px] text-body">
            You&apos;ve been signed out. The admin console is limited to Google accounts on the NorthTap admin list. Ask
            an admin to add you, then sign in again.
          </p>
        </div>
        <Link
          href="/login"
          className="flex h-11 items-center justify-center rounded-[10px] border border-teal px-4 text-[15px] font-semibold no-underline"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
