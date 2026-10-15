import { Breadcrumbs } from "@/components/breadcrumbs";
import type { Crumb } from "@/components/breadcrumbs";
import { CardCalculator } from "@/components/card-calculator";
import type { CalculatorCard } from "@/components/card-calculator";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { OpenAppLink } from "@/components/open-app-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  CATALOG,
  cardDisplayName,
  dollarsBack,
  earnLabel,
  formatAnnualFee,
  formatDollars,
  formatIsoDate,
  isCashback,
  pointValueLabel,
} from "@/lib/catalog";
import type { RankedCatalogCard } from "@/lib/catalog";
import { DEFAULT_AMOUNT, MAX_PICKS } from "@/lib/category-pages";
import type { CategoryPage, CategoryPageData } from "@/lib/category-pages";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/json-ld";
import { CONTAINER, SECTION, SECTION_HEADING, TEXT_LINK } from "@/lib/styles";

export function categoryBreadcrumbs(page: CategoryPage): Crumb[] {
  return [
    { name: "Home", path: "/" },
    { name: page.label, path: page.path },
  ];
}

function calculatorDetail(r: RankedCatalogCard): string {
  const earn = earnLabel(r.card, r.earnRate);
  return isCashback(r.card) ? earn : `${earn} at ${r.pointValue}¢/pt`;
}

function calculatorCards(ranked: RankedCatalogCard[]): CalculatorCard[] {
  return ranked.map((r, rank) => ({
    id: r.card.id,
    name: cardDisplayName(r.card),
    issuer: r.card.issuer,
    rank,
    centsPerDollar: r.centsPerDollar,
    detail: calculatorDetail(r),
  }));
}

function capNote(r: RankedCatalogCard): string | null {
  if (r.reward?.capMonthly !== undefined) {
    return `On up to $${r.reward.capMonthly.toLocaleString("en-CA")} a month`;
  }
  if (r.reward?.capAnnual !== undefined) {
    return `On up to $${r.reward.capAnnual.toLocaleString("en-CA")} a year`;
  }
  if (!r.reward) return "Base rate";
  return null;
}

function TopCardsTable({ page, topCards }: Pick<CategoryPageData, "page" | "topCards">) {
  return (
    <section id="top-cards" aria-labelledby="top-cards-heading" className={CONTAINER}>
      <div className={SECTION}>
        <div className="flex flex-col gap-3">
          <h2 id="top-cards-heading" className={SECTION_HEADING}>
            Top cards for {page.label.toLowerCase()}
          </h2>
          <p className="max-w-[720px] text-base leading-[1.6] text-body lg:text-[17px]">
            The {topCards.length} cards in NorthTap&apos;s catalog that give back
            the most {page.onNoun}, per ${DEFAULT_AMOUNT} spent.{" "}
            <a href="#point-values" className={TEXT_LINK}>
              Points are valued at these rates
            </a>
            .
          </p>
        </div>
        <div
          role="region"
          aria-labelledby="top-cards-heading"
          tabIndex={0}
          className="-mx-6 overflow-x-auto px-6 focus-visible:outline-2 focus-visible:outline-accent md:mx-0 md:px-0"
        >
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <caption className="sr-only">
              Top {topCards.length} cards for {page.noun}, best first
            </caption>
            <thead>
              <tr className="border-b border-divider text-[13px] text-muted">
                <th scope="col" className="py-3 pr-4 font-semibold">Card</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Issuer</th>
                <th scope="col" className="py-3 pr-4 text-right font-semibold">Annual fee</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Earn rate {page.onNoun}</th>
                <th scope="col" className="py-3 pr-4 text-right font-semibold">Point value</th>
                <th scope="col" className="py-3 text-right font-semibold">Back per ${DEFAULT_AMOUNT}</th>
              </tr>
            </thead>
            <tbody>
              {topCards.map((r) => {
                const note = capNote(r);
                return (
                  <tr key={r.card.id} className="border-b border-divider align-top">
                    <th scope="row" className="py-3.5 pr-4 font-semibold text-foreground">
                      {r.card.name}
                    </th>
                    <td className="py-3.5 pr-4 text-body">{r.card.issuer}</td>
                    <td className="py-3.5 pr-4 text-right text-body tabular-nums">
                      {formatAnnualFee(r.card.annualFee)}
                    </td>
                    <td className="py-3.5 pr-4 text-body">
                      {earnLabel(r.card, r.earnRate)}
                      {note && <span className="block text-[13px] text-muted">{note}</span>}
                    </td>
                    <td className="py-3.5 pr-4 text-right text-body tabular-nums">
                      {pointValueLabel(r.card, r.pointValue)}
                    </td>
                    <td className="py-3.5 text-right font-display text-lg font-semibold text-foreground tabular-nums">
                      {formatDollars(dollarsBack(DEFAULT_AMOUNT, r.centsPerDollar))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HowWeCalculate({ page, ranked }: Pick<CategoryPageData, "page" | "ranked">) {
  const example = ranked.find((r) => !isCashback(r.card));
  const valuations = Object.entries(CATALOG.valuations)
    .filter(([currency]) => currency !== "cashback")
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <section id="how-we-calculate" aria-labelledby="calc-heading" className={CONTAINER}>
      <div className={SECTION}>
        <h2 id="calc-heading" className={SECTION_HEADING}>
          How we calculate
        </h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col gap-4 text-base leading-[1.6] text-body lg:text-[17px]">
            <p>
              Dollars back = purchase amount × earn rate × point value. The earn
              rate is what a card pays per dollar {page.onNoun}; if a card has no{" "}
              {page.noun} rate, we use its base rate. Cash back counts at face
              value, and points are valued at the{" "}
              <a href="#point-values" className={TEXT_LINK}>
                estimates listed here
              </a>
              .
            </p>
            {example && (
              <p>
                For example, {earnLabel(example.card, example.earnRate)} at{" "}
                {example.pointValue}¢ a point is{" "}
                {Math.round(example.centsPerDollar * 100) / 100}¢ per dollar, or{" "}
                {formatDollars(dollarsBack(DEFAULT_AMOUNT, example.centsPerDollar))} back
                on ${DEFAULT_AMOUNT}.
              </p>
            )}
            <p>
              Cards that tie are ordered by the lower annual fee. Where a card caps
              its bonus rate, we assume you are under the cap. Welcome offers and
              store loyalty programs aren&apos;t included.
            </p>
          </div>
          <div id="point-values" className="flex scroll-mt-6 flex-col gap-4">
            <h3 className="font-display text-[19px] font-semibold text-foreground md:text-xl">
              Point values we use
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3">
              {valuations.map(([currency, cents]) => (
                <div
                  key={currency}
                  className="flex justify-between gap-3 border-b border-divider py-1.5"
                >
                  <dt className="text-body">{currency}</dt>
                  <dd className="text-foreground tabular-nums">{cents}¢</dd>
                </div>
              ))}
            </dl>
            <p className="text-[13px] leading-[1.5] text-muted">
              Cents per point, in Canadian dollars. Cash back is worth 1¢ per
              cent earned.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryPageView({ data }: { data: CategoryPageData }) {
  const { page, ranked, topCards, faqs, ratesLastChecked } = data;
  const crumbs = categoryBreadcrumbs(page);

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), faqPageJsonLd(faqs)]} />
      <SiteHeader />
      <main>
        <div className={CONTAINER}>
          <div className="flex w-full flex-col gap-4 pt-4 pb-12 md:gap-5 md:pt-6 md:pb-20 lg:grid lg:grid-cols-[minmax(0,1fr)_min(560px,50%)] lg:items-start lg:gap-x-16 lg:pb-28 xl:gap-x-24">
            <div className="flex flex-col gap-4 md:gap-5 lg:pt-10">
              <Breadcrumbs items={crumbs} />
              <h1 className="font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground md:text-[44px] md:leading-[1.06] lg:mt-4 lg:text-[clamp(40px,4vw,56px)]">
                {page.h1}
              </h1>
              <p className="text-[17px] leading-[1.6] text-body md:text-lg lg:max-w-[520px] lg:text-xl">
                {page.intro}
              </p>
              <p className="text-sm text-muted">
                Rates last checked{" "}
                <time dateTime={ratesLastChecked}>{formatIsoDate(ratesLastChecked)}</time>
              </p>
            </div>
            <CardCalculator
              className="mt-2 lg:mt-0"
              categoryNoun={page.noun}
              cards={calculatorCards(ranked)}
              defaultPicks={page.defaultPicks}
              defaultAmount={DEFAULT_AMOUNT}
              maxPicks={MAX_PICKS}
            />
          </div>
        </div>
        <TopCardsTable page={page} topCards={topCards} />
        <HowWeCalculate page={page} ranked={ranked} />
        <FaqSection faqs={faqs} />
        <section aria-labelledby="cta-heading" className={CONTAINER}>
          <div className={`${SECTION} items-start`}>
            <div className="flex flex-col gap-3">
              <h2 id="cta-heading" className={SECTION_HEADING}>
                Use the best card every time you pay
              </h2>
              <p className="max-w-[640px] text-base leading-[1.6] text-body lg:text-[17px]">
                Add the cards you carry once, and NorthTap tells you which one to
                tap {page.onNoun} and everywhere else. Free, no account needed,
                no bank linking.
              </p>
            </div>
            <OpenAppLink size="lg">Try it with your cards</OpenAppLink>
            <p className="text-sm leading-[1.6] text-muted">
              Not financial advice. Rates come from NorthTap&apos;s card catalog,
              last checked{" "}
              <time dateTime={ratesLastChecked}>{formatIsoDate(ratesLastChecked)}</time>,
              and can change; confirm rates and terms with your issuer before you
              apply.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
