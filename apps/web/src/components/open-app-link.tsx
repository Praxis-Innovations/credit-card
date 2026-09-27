import { APP_PATH } from "@/lib/routes";

const SIZES = {
  sm: "h-11 px-4 text-[15px] lg:px-5",
  lg: "h-[52px] w-full px-7 text-[17px] sm:w-auto",
} as const;

export function OpenAppLink({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <a
      href={APP_PATH}
      className={`inline-flex items-center justify-center rounded-[10px] bg-primary font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${SIZES[size]} ${className}`}
    >
      Open the app
    </a>
  );
}
