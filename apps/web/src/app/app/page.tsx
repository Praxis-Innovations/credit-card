import type { Metadata } from "next";
import { RecommenderApp } from "@/components/app/recommender-app";

export const metadata: Metadata = {
  title: "NorthTap App — Purchase card recommender",
  description:
    "Enter a purchase amount and category to see which of your Canadian credit cards earns the most back, with clear reasoning.",
};

export default function AppPage() {
  return <RecommenderApp />;
}
