/** NorthTap mark + wordmark with the "Admin" badge. The mark is decorative. */
export function BrandLogo({ badge = true }: { badge?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
      <img src="/brand/northtap-mark.svg" alt="" width={34} height={24} className="h-6 w-auto" />
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">
        North<span className="text-teal">Tap</span>
      </span>
      {badge ? (
        <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
      ) : null}
    </span>
  );
}
