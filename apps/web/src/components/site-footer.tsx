export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
            NorthTap
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Working title · not financial advice
          </p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-right">
          Rates are curated estimates. Verify with your issuer before deciding.
        </p>
      </div>
    </footer>
  );
}
