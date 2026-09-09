import type { Metadata } from "next";
import { PricingApp } from "@/components/pricing-app";

export const metadata: Metadata = {
  title: "Pricing & Commercial ROI",
  description: "Self-funding AI gateway. Cut your LLM costs by 65% with zero-downtime multi-provider failover and virtual budget keys.",
};

export default function PricingPage() {
  return <PricingApp />;
}
