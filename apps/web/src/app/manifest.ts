import type { MetadataRoute } from "next";
import { BRAND_OFF_WHITE, BRAND_TEAL } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NorthTap",
    short_name: "NorthTap",
    description: "The right card for every purchase.",
    start_url: "/",
    display: "browser",
    background_color: BRAND_OFF_WHITE,
    theme_color: BRAND_TEAL,
    icons: [
      {
        src: "/brand/northtap-app-icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        src: "/brand/northtap-app-icon-512.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
  };
}
