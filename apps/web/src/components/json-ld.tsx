import { API_URL, DOCS_HOME, DOCS_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export function JsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon.svg`,
        },
        sameAs: ["https://github.com/sreecharan-desu/promptimizer"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        headline: SITE_TAGLINE,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Bring your own OpenAI-compatible API keys. No routing fee.",
        },
        featureList: [
          "Difficulty classification",
          "Multi-tier model routing",
          "Prompt and semantic caching",
          "Quality gate with escalation",
          "BYOK OpenAI-compatible API",
        ],
        softwareHelp: {
          "@type": "CreativeWork",
          url: DOCS_HOME,
        },
        downloadUrl: "https://www.npmjs.com/package/promptimizer",
        installUrl: `${DOCS_URL}/docs/quickstart`,
        discussionUrl: `${DOCS_URL}/docs/api`,
        codeRepository: "https://github.com/sreecharan-desu/promptimizer",
        provider: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebAPI",
        "@id": `${SITE_URL}/#api`,
        name: `${SITE_NAME} API`,
        description: "OpenAI-compatible chat completions gateway with routing metadata.",
        documentation: `${DOCS_URL}/docs/api`,
        url: `${API_URL}/v1`,
        provider: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
