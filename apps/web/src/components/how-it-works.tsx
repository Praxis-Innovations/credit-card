const STEPS = [
  {
    title: "Build your wallet",
    body: "Add the Canadian cards you already carry. NorthTap ranks from what you own, not a generic top-ten list.",
  },
  {
    title: "Name the purchase",
    body: "Groceries, dining, gas, travel, foreign spend, and more. The category you are about to tap is what matters.",
  },
  {
    title: "See the winner",
    body: "A deterministic cents-back-per-dollar ranking shows which card earns the most for that purchase, with a clear why.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-b border-border py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="max-w-md font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              Purchase-specific picks, not yearly averages.
            </h2>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              NorthTap answers one question at the terminal: which card in your
              wallet should you tap for this spend?
            </p>
          </div>

          <ol className="space-y-0 border-t border-border">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[auto_1fr] gap-x-5 border-b border-border py-7"
              >
                <p className="font-mono-nums pt-1 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h3 className="font-display text-xl tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
