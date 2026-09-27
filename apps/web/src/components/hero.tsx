import { HeroCards } from "@/components/hero-cards";
import { OpenAppLink } from "@/components/open-app-link";
import { CONTAINER } from "@/lib/styles";

export function Hero() {
  return (
    <section
      id="top"
      className={`${CONTAINER} flex flex-col items-center pt-16 pb-[72px] text-center md:pt-24 md:pb-24 lg:pt-[136px] lg:pb-[120px]`}
    >
      <p className="mb-[18px] text-sm text-muted md:mb-6 md:text-[15px]">
        For Canadian cardholders
      </p>
      <h1 className="max-w-[760px] font-display text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-foreground md:text-5xl md:leading-[1.1] lg:text-[60px]">
        The right card for every purchase.
      </h1>
      <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-body md:mt-7 md:text-lg lg:text-xl">
        NorthTap looks at where you&apos;re shopping and tells you which card in
        your wallet earns the most.
      </p>
      <OpenAppLink size="lg" className="mt-8 md:mt-10" />
      <p className="mt-3.5 text-sm text-muted md:mt-4">
        Free · no account needed
      </p>
      <HeroCards className="mt-12 md:mt-[88px]" />
    </section>
  );
}
