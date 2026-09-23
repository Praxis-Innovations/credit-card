/**
 * Static product preview only. Not wired to recommendCards.
 * The live experience is the Expo web app (see APP_PATH in lib/routes).
 */
export function ProductDemo() {
  return (
    <section id="product" className="scroll-mt-24 border-b border-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            A clear ranking for the moment before you tap.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Preview of the purchase-specific recommender. Open the app to run it
            on your own wallet.
          </p>
        </div>

        <figure className="mt-10">
          <div
            className="surface-panel overflow-hidden"
            role="img"
            aria-label="Static preview of NorthTap ranking American Express Cobalt first for a groceries purchase at 5 cents per dollar, ahead of Gold Rewards and a cash-back card"
          >
            <div className="grid lg:grid-cols-[0.95fr_1.15fr]">
              {/* Wallet column */}
              <div className="border-b border-border p-5 lg:border-b-0 lg:border-r lg:p-6">
                <p className="font-display text-lg text-foreground">Your cards</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  3 selected · sample wallet
                </p>
                <ul className="mt-5 divide-y divide-border/80 border-y border-border/80">
                  {[
                    { name: "Cobalt", meta: "Amex MR · $155/yr", on: true },
                    { name: "Gold Rewards", meta: "Amex MR · $250/yr", on: true },
                    {
                      name: "CashBack Mastercard",
                      meta: "Cash · no fee",
                      on: true,
                    },
                    { name: "Aeroplan", meta: "Aeroplan · $120/yr", on: false },
                  ].map((card) => (
                    <li
                      key={card.name}
                      className={`flex items-start gap-3 py-3 ${card.on ? "bg-[var(--surface-tint)]" : ""}`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${
                          card.on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-transparent"
                        }`}
                        aria-hidden
                      >
                        {card.on ? "✓" : ""}
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">
                          {card.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {card.meta}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Category + results */}
              <div className="flex flex-col gap-5 p-5 lg:p-6">
                <div>
                  <p className="font-display text-lg text-foreground">
                    Spending category
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ranking for groceries
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Groceries", "Dining", "Gas", "Travel", "Transit"].map(
                      (label) => (
                        <span
                          key={label}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                            label === "Groceries"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-display text-lg text-foreground">
                    Best card to use
                  </p>
                  <ol className="mt-3 space-y-2.5">
                    <li
                      className="border border-transparent px-4 py-4"
                      style={{
                        backgroundColor: "var(--result-top)",
                        color: "var(--result-top-fg)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium opacity-75">
                            American Express
                          </p>
                          <p className="mt-1 font-display text-xl tracking-tight sm:text-2xl">
                            Cobalt
                          </p>
                          <p className="mt-1 text-sm opacity-80">
                            5x Amex MR on groceries, valued at 5¢/$
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono-nums text-2xl font-semibold text-highlight sm:text-3xl">
                            5¢/$
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium opacity-65">
                            back
                          </p>
                        </div>
                      </div>
                    </li>
                    {[
                      {
                        issuer: "American Express",
                        name: "Gold Rewards",
                        reason: "2x Amex MR on groceries",
                        rate: "2.4¢/$",
                      },
                      {
                        issuer: "BMO",
                        name: "CashBack Mastercard",
                        reason: "Flat cash back",
                        rate: "1¢/$",
                      },
                    ].map((row, i) => (
                      <li
                        key={row.name}
                        className="border border-border bg-card px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {i + 2}. {row.issuer}
                            </p>
                            <p className="mt-1 font-display text-lg tracking-tight text-foreground">
                              {row.name}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {row.reason}
                            </p>
                          </div>
                          <p className="font-mono-nums shrink-0 text-xl font-semibold text-primary">
                            {row.rate}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Illustrative preview with sample rates. Live rankings run in the app.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
