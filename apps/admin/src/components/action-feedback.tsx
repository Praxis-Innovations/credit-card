"use client";

import { useState, useTransition } from "react";

export type Notice = { ok: boolean; message: string };

type ActionOutcome = { ok: boolean; message: string };

/** Live region for server-action success/error messages. */
export function ActionNotice({ notice }: { notice: Notice | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        notice
          ? `rounded-lg px-4 py-2.5 text-sm font-medium ${notice.ok ? "bg-ok-bg text-ok-fg" : "bg-bad-bg text-bad-fg"}`
          : "sr-only"
      }
    >
      {notice?.message ?? ""}
    </p>
  );
}

export function LoadError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
      {message}
    </p>
  );
}

/** Shared pending-key + notice runner for console mutations. */
export function usePendingAction() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (key: string, action: () => Promise<ActionOutcome>) => {
    setPendingKey(key);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      } finally {
        setPendingKey(null);
      }
    });
  };

  return {
    notice,
    setNotice,
    pendingKey,
    busy: pendingKey !== null,
    run,
  };
}
