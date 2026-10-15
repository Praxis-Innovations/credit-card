import type { Faq } from "@/lib/faq";
import { CONTAINER, SECTION, SECTION_HEADING } from "@/lib/styles";

/** Visible FAQ; pair it with faqPageJsonLd(faqs) so the markup matches the text. */
export function FaqSection({
  faqs,
  heading = "Questions",
}: {
  faqs: readonly Faq[];
  heading?: string;
}) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className={CONTAINER}>
      <div className={SECTION}>
        <h2 id="faq-heading" className={SECTION_HEADING}>
          {heading}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 md:gap-x-12 md:gap-y-10">
          {faqs.map((faq) => (
            <div key={faq.question} className="flex flex-col gap-2">
              <h3 className="font-display text-[19px] leading-[1.3] font-semibold text-foreground md:text-xl">
                {faq.question}
              </h3>
              <p className="text-base leading-[1.6] text-body lg:text-[17px]">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
