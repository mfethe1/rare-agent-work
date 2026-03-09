const ORGANIZATION = {
  "@type": "Organization",
  name: "Rare Agent Work",
  url: "https://rareagent.work",
  logo: {
    "@type": "ImageObject",
    url: "https://rareagent.work/logo-badge-color.jpg",
  },
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
      potentialAction: {
        "@type": "SearchAction",
        target: "https://rareagent.work/news?tag={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      ...ORGANIZATION,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Rare Agent Work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Rare Agent Work publishes operator-grade AI research reports — practical playbooks for setting up AI agents, scaling to multi-agent systems, and evaluating production deployments. Not tutorials or overviews, but implementation-ready guides.",
          },
        },
        {
          "@type": "Question",
          name: "How do I set up my first AI agent?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Our 'Agent Setup in 60 Minutes' report walks you through platform selection (Zapier, Make, n8n, Relevance AI), building a trigger-to-action chain, adding human-in-the-loop approval gates, and testing with production data — all in under an hour.",
          },
        },
        {
          "@type": "Question",
          name: "What is multi-agent orchestration?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Multi-agent orchestration is the practice of coordinating multiple AI agents to work together on complex tasks. Our 'From Single Agent to Multi-Agent' report covers framework selection, memory architecture, and the planner-executor-reviewer pattern used in production systems.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebAPI",
      name: "Rare Agent Work API",
      url: "https://rareagent.work/api/openapi.json",
      documentation: "https://rareagent.work/llms.txt",
      description:
        "Public JSON API providing curated AI agent news, report catalog, and weekly digests. Designed for consumption by AI agents and LLMs.",
      provider: ORGANIZATION,
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
    image: "https://rareagent.work/og-image.png",
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
