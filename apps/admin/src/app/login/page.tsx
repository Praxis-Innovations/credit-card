import type { Metadata } from "next";
import { signInWithGoogle } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  auth: "Google sign-in didn't complete. Try again.",
  missing_code: "Google sign-in didn't complete. Try again.",
  oauth: "Couldn't start Google sign-in. Try again.",
  origin: "Open the console from its own address and try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.auth) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-line bg-surface p-8">
        <BrandLogo />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold">Sign in to the admin console</h1>
          <p className="text-[15px] text-body">Use the Google account on the NorthTap admin list.</p>
        </div>
        {message ? (
          <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad-fg">
            {message}
          </p>
        ) : null}
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-teal px-4 text-[15px] font-semibold text-white hover:bg-teal-hover"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
              <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
              <path fill="#fff" opacity=".85" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#fff" opacity=".7" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
              <path fill="#fff" opacity=".85" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
