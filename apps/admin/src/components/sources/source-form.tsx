"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveSource, type ActionResult } from "@/app/(console)/sources/actions";
import type { CrawlSource } from "@/lib/sources/types";
import type { FieldErrors, SourceFormValues } from "@/lib/sources/validation";

const inputClass =
  "h-10 w-full rounded-lg border border-field bg-surface px-2.5 font-sans text-sm text-ink aria-[invalid=true]:border-bad-fg";

function Field({
  id,
  label,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[13px] text-body">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-bad-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: boolean, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function SourceForm({
  source,
  onSaved,
  onCancel,
}: {
  source: CrawlSource | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveSource, null);
  const [values, setValues] = useState<SourceFormValues>({
    issuer_name: source?.issuer_name ?? "",
    compare_url: source?.compare_url ?? "",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const ids = {
    heading: `${uid}-heading`,
    name: `${uid}-name`,
    url: `${uid}-url`,
  };

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      onSaved(state.message);
      return;
    }
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, onSaved]);

  const errors: FieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const set = (key: keyof SourceFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const editing = source !== null;

  return (
    <section
      aria-labelledby={ids.heading}
      className="flex flex-col gap-3.5 rounded-xl border-2 border-teal bg-surface p-5"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <h2 id={ids.heading} className="text-[17px] font-semibold">
        {editing ? `Edit ${source.issuer_name}` : "Add an issuer to the scrape list"}
      </h2>
      <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3.5">
        {editing ? <input type="hidden" name="id" value={source.id} /> : null}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <Field id={ids.name} label="Issuer name" error={errors.issuer_name}>
            <input
              ref={nameRef}
              id={ids.name}
              name="issuer_name"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="e.g. Tangerine"
              value={values.issuer_name}
              onChange={set("issuer_name")}
              aria-invalid={errors.issuer_name ? true : undefined}
              aria-describedby={describedBy(ids.name, false, errors.issuer_name)}
              className={inputClass}
            />
          </Field>
          <Field
            id={ids.url}
            label="Compare page URL (official site only)"
            hint="https only, on the issuer's own domain. Leave blank if it isn't set up yet."
            error={errors.compare_url}
          >
            <input
              id={ids.url}
              name="compare_url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              value={values.compare_url}
              onChange={set("compare_url")}
              aria-invalid={errors.compare_url ? true : undefined}
              aria-describedby={describedBy(ids.url, true, errors.compare_url)}
              className={inputClass}
            />
          </Field>
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-sm font-semibold text-bad-fg">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-[10px] bg-teal px-4 text-[15px] font-semibold text-white hover:bg-teal-hover disabled:opacity-70"
          >
            {pending ? "Saving…" : "Save issuer"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-[10px] border border-field bg-surface px-4 text-[15px] hover:bg-teal-soft"
          >
            Cancel
          </button>
          <span className="text-[13px] text-muted">
            Without a compare URL the issuer stays &ldquo;Not set up&rdquo;.
          </span>
        </div>
      </form>
    </section>
  );
}
