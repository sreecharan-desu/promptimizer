import { DOCS_URL } from "@/lib/site";
import { ClassifySpot, RouteSpot, SaveSpot } from "./home-spots";

const FEATURES = [
  {
    href: `${DOCS_URL}/docs/guides/classification`,
    name: "Classify",
    title: "Know the ask before you spend.",
    dek: "Each request gets a complexity score and a quality risk before any model is called.",
    art: <ClassifySpot />,
  },
  {
    href: `${DOCS_URL}/docs/guides/routing`,
    name: "Route",
    title: "Send it where it belongs.",
    dek: "Economy when the ask is light. Frontier when it isn't. Escalate only when the answer fails the gate.",
    art: <RouteSpot />,
  },
  {
    href: `${DOCS_URL}/docs/guides/caching`,
    name: "Measure",
    title: "Keep the ledger honest.",
    dek: "Cache repeated prefixes, record cost versus always-frontier, and keep a quality gate on every answer.",
    art: <SaveSpot />,
  },
] as const;

export function HomeFeatures() {
  return (
    <div className="pt-8 sm:pt-12">
      {FEATURES.map((feature, index) => {
        const reverse = index % 2 === 1;
        return (
          <div
            key={feature.name}
            className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-12 ${index > 0 ? "mt-16 sm:mt-24" : ""}`}
          >
            <a
              href={feature.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group/card block overflow-hidden rounded-2xl transition-transform duration-500 ease-out hover:scale-[1.02] ${
                reverse ? "lg:order-2" : ""
              }`}
            >
              {feature.art}
            </a>
            <div className={reverse ? "lg:order-1" : ""}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{feature.name}</p>
              <h2 className="mt-3 max-w-md font-display text-3xl font-medium tracking-tight text-primary text-balance sm:text-4xl">
                {feature.title}
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-secondary">{feature.dek}</p>
              <a
                href={feature.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
              >
                Read the guide →
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
