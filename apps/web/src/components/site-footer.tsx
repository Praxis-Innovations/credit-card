import { APP_PATH } from "@/lib/routes";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
            NorthTap
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Working title · not financial advice
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={APP_PATH}
            className="text-sm font-semibold text-primary transition-colors hover:text-foreground"
          >
            Open the app
          </a>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-right">
            Rates are curated estimates. Verify with your issuer before deciding.
          </p>
        </div>
      </div>
    </footer>
  );
}
