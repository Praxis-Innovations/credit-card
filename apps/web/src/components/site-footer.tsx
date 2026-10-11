import { BrandLogo } from "@/components/brand-logo";
import { CONTAINER } from "@/lib/styles";

/** The rule is full-bleed on phones and inset to the content width from md. */
export function SiteFooter() {
  return (
    <footer className="border-t border-divider md:border-t-0">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-1.5 pt-6 pb-8 text-[13px] text-muted md:flex-row md:items-center md:justify-between md:border-t md:border-divider md:pt-8 md:pb-10 md:text-sm">
          <p className="flex">
            <BrandLogo size="sm" />
          </p>
          <p>Not financial advice. Confirm rates with your issuer.</p>
        </div>
      </div>
    </footer>
  );
}
