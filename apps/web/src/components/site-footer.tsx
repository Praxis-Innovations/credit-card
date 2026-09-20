export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display font-semibold text-foreground">
            CardCoach
          </span>{" "}
          · working title · not financial advice
        </p>
        <p className="text-xs">
          Rates are curated estimates — verify with your issuer before deciding.
        </p>
      </div>
    </footer>
  );
}
