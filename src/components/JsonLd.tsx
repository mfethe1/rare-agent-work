const ORGANIZATION = {
  "@type": "Organization",
  name: "Rare Agent Work",
  url: "https://rareagent.work",
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@rareagent.work",
    contactType: "customer service",
  },
};

export function WebsiteJsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Rare Agent Work",
      url: "https://rareagent.work",
      description:
        "Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards.",
      publisher: ORGANIZATION,
    },
    {
      "@context": "https://schema.org",
      ...ORGANIZATION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebAPI",
      name: "Rare Agent Work API",
      url: "https://rareagent.work/api/openapi.json",
      documentation: "https://rareagent.work/llms.txt",
      description:
        "Public JSON API providing agentic model leaderboard data, curated AI agent news, report catalog, and weekly digests. Designed for consumption by AI agents and LLMs.",
      provider: ORGANIZATION,
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Agentic Model Leaderboard",
      url: "https://rareagent.work/api/models",
      description:
        "LLMs ranked for agentic use: tool calling accuracy, context recall, coding ability, and cost efficiency. Updated regularly with benchmark data.",
      creator: ORGANIZATION,
      license: "https://rareagent.work",
      distribution: {
        "@type": "DataDownload",
        contentUrl: "https://rareagent.work/api/models",
        encodingFormat: "application/json",
      },
    },
  ];

  return (
    <>
      {data.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ReportJsonLd({
  title,
  description,
  slug,
  price,
  datePublished = "2026-03-04",
}: {
  title: string;
  description: string;
  slug: string;
  price: string;
  datePublished?: string;
}) {
  const priceNum = price.replace(/[^0-9.]/g, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    url: `https://rareagent.work/reports/${slug}`,
    brand: ORGANIZATION,
    offers: {
      "@type": "Offer",
      price: priceNum,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `https://rareagent.work/reports/${slug}`,
    },
    datePublished,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
