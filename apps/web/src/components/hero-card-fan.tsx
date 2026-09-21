/**
 * Decorative photo-realistic card fan for the hero.
 * Purely visual - not interactive, not wired to recommendCards.
 */
export function HeroCardFan({ className = "" }: { className?: string }) {
  const cards = [
    {
      label: "Cash",
      rotate: "-14deg",
      z: 1,
      fill: "linear-gradient(145deg, #1a3a34 0%, #0c5c56 55%, #147a6e 100%)",
      x: "0%",
    },
    {
      label: "Travel",
      rotate: "2deg",
      z: 2,
      fill: "linear-gradient(145deg, #1c2430 0%, #2a3544 50%, #3d4d63 100%)",
      x: "18%",
    },
    {
      label: "Groceries",
      rotate: "16deg",
      z: 3,
      fill: "linear-gradient(145deg, #2a1810 0%, #5c3a28 45%, #8a5a3c 100%)",
      x: "36%",
    },
  ] as const;

  return (
    <div
      className={`pointer-events-none relative h-[11.5rem] w-[18.5rem] sm:h-[13rem] sm:w-[21rem] ${className}`}
      aria-hidden
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="absolute bottom-0 left-0 h-[7.25rem] w-[11.5rem] overflow-hidden rounded-xl border border-white/20 shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:h-[8.25rem] sm:w-[13rem]"
          style={{
            background: card.fill,
            transform: `translateX(${card.x}) rotate(${card.rotate})`,
            zIndex: card.z,
          }}
        >
          <div className="absolute left-4 top-4 h-7 w-9 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-500/70 opacity-90 sm:h-8 sm:w-10" />
          <div className="absolute right-4 top-4 h-5 w-5 rounded-full border border-white/35" />
          <p className="absolute bottom-8 left-4 font-mono text-[10px] tracking-[0.22em] text-white/55 sm:text-[11px]">
            •••• 4281
          </p>
          <p className="absolute bottom-3 left-4 text-[11px] font-semibold tracking-wide text-white/90 sm:text-xs">
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}
