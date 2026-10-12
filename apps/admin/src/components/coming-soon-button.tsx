"use client";

import { useId, type ReactNode } from "react";

/**
 * A visible but inert button. It uses aria-disabled instead of `disabled` so
 * it stays focusable and keyboard users can reach the "coming soon" tooltip.
 */
export function ComingSoonButton({ children, tooltip = "Coming soon" }: { children: ReactNode; tooltip?: string }) {
  const tipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={tipId}
        onClick={(e) => e.preventDefault()}
        className="h-8 cursor-not-allowed rounded-lg border border-line bg-canvas px-3 text-[13px] text-muted"
      >
        {children}
      </button>
      <span
        role="tooltip"
        id={tipId}
        className="pointer-events-none absolute top-1/2 right-full z-10 mr-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
}
