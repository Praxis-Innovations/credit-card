import { CONTAINER } from "@/lib/styles";

export function SiteFooter() {
  return (
    <footer className="border-t border-divider">
      <div
        className={`${CONTAINER} flex flex-col gap-1.5 pt-6 pb-8 text-[13px] text-muted md:flex-row md:items-center md:justify-between md:pt-8 md:pb-10 md:text-sm`}
      >
        <p className="font-display text-base font-semibold text-foreground md:text-[17px]">
          NorthTap
        </p>
        <p>Not financial advice. Confirm rates with your issuer.</p>
      </div>
    </footer>
  );
}
