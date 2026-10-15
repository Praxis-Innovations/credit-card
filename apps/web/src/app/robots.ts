import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo-routes";

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}
