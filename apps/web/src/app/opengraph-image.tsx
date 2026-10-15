import { HOME_H1 } from "@/lib/home";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageAlt, renderOgImage } from "@/lib/og-image";

export const alt = ogImageAlt(HOME_H1);
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage(HOME_H1);
}
