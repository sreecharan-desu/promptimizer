import Link from "next/link";
import { ClassifySpot, RouteSpot, SaveSpot } from "./home-spots";

const FEATURES = [
  {
    href: "/docs/guides/classification",
    name: "Classify",
    title: "Know the ask before you spend.",
    dek: "Each request gets a complexity and a quality risk before any model is called.",
    art: <ClassifySpot />,
  },
  {
    href: "/docs/guides/routing",
    name: "Route",
    title: "Take the shorter road.",
    dek: "Send it to the cheapest tier that can still answer. Escalate only when quality fails.",
    art: <RouteSpot />,
  },
  {
    href: "/docs/guides/caching",
    name: "Save",
    title: "Keep the savings honest.",
    dek: "Cache repeated prefixes, record cost versus always-frontier, and keep a quality gate on every answer.",
    art: <SaveSpot />,
  },
] as const;

export function HomeFeatures() {
  return (
    <div className="mt-16">
      {FEATURES.map((feature, index) => {
        const reverse = index % 2 === 1;
        return (
          <div
            key={feature.name}
            className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-12 ${index > 0 ? "mt-16 sm:mt-24" : ""}`}
          >
            <Link
              href={feature.href}
              className={`group/card block overflow-hidden rounded-2xl transition-transform duration-500 ease-out hover:scale-[1.02] ${
                reverse ? "lg:order-2" : ""
              }`}
            >
              {feature.art}
            </Link>
            <div className={reverse ? "lg:order-1" : ""}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{feature.name}</p>
              <h2 className="mt-3 max-w-md font-display text-3xl font-medium tracking-tight text-primary text-balance sm:text-4xl">
                {feature.title}
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-secondary">{feature.dek}</p>
              <Link
                href={feature.href}
                className="mt-6 inline-flex text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
              >
                Read the guide →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
