import type { ReactNode } from "react";
import { APP_PATH } from "@/lib/routes";

const SIZES = {
  sm: "h-11 px-4 text-[15px] font-medium lg:px-5",
  lg: "h-[52px] w-full px-7 text-[17px] font-semibold lg:w-auto",
} as const;

export function OpenAppLink({
  size = "sm",
  className = "",
  children = "Open the app",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={APP_PATH}
      className={`inline-flex items-center justify-center rounded-[10px] bg-primary whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${SIZES[size]} ${className}`}
    >
      {children}
    </a>
  );
}
