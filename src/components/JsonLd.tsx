const SITE_URL = "https://rareagent.work";

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Rare Agent Work",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo-badge-color.jpg`,
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@rareagent.work",
    contactType: "customer service",
  },
  sameAs: [
    `${SITE_URL}/news`,
    `${SITE_URL}/network`,
    `${SITE_URL}/pricing`,
  ],
};

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  return <JsonLdScript data={{ "@context": "https://schema.org", ...ORGANIZATION }} />;
}

export function WebsiteJsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Rare Agent Work",
      url: SITE_URL,
      description:
        "Trusted multi-agent execution research, consulting, and operator-grade brief intake for teams shipping real AI systems.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/news?tag={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
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
            text: "Rare Agent Work helps teams scope, evaluate, and execute serious AI agent work through operator-grade research, trusted consulting, and curated access to proven builders.",
          },
        },
        {
          "@type": "Question",
          name: "What kind of work fits best?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The best fit is high-trust implementation work: multi-agent operations, workflow redesign, agent reliability, internal copilots, and scoped delivery where teams need judgment as much as code.",
          },
        },
        {
          "@type": "Question",
          name: "How should a team start?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Start with a concrete brief. Share the workflow, the failure point, the trust constraints, and the outcome you need. That makes it easier to qualify the work and route it to the right operator or consulting path.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebAPI",
      name: "Rare Agent Work API",
      url: `${SITE_URL}/api/openapi.json`,
      documentation: `${SITE_URL}/llms.txt`,
      description:
        "Public JSON API providing curated AI agent news, report catalog, and weekly digests. Designed for consumption by AI agents and LLMs.",
      provider: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  return (
    <>
      <OrganizationJsonLd />
      {data.map((d, i) => (
        <JsonLdScript key={i} data={d} />
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

  return <JsonLdScript data={data} />;
}

export function FAQJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLdScript data={data} />;
}

export function ServiceJsonLd({
  name,
  description,
  url,
  areaServed = "Global",
  serviceType = "AI agent consulting",
}: {
  name: string;
  description: string;
  url: string;
  areaServed?: string;
  serviceType?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    serviceType,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed,
    audience: {
      "@type": "Audience",
      audienceType: "Teams deploying or evaluating AI agents",
    },
  };

  return <JsonLdScript data={data} />;
}

export function ReportJsonLd({
  title,
  description,
  slug,
  price,
  author = "Michael Fethe",
  datePublished = "2026-03-04",
  dateModified,
}: {
  title: string;
  description: string;
  slug: string;
  price: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const priceNum = price.replace(/[^0-9.]/g, "");
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      description,
      url: `${SITE_URL}/reports/${slug}`,
      image: `${SITE_URL}/og-image.png`,
      brand: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: priceNum,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/reports/${slug}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Report",
      name: title,
      description,
      url: `${SITE_URL}/reports/${slug}`,
      datePublished,
      dateModified: dateModified ?? datePublished,
      publisher: { "@id": `${SITE_URL}/#organization` },
      author: { "@type": "Person", name: author },
    },
  ];

  return (
    <>
      {data.map((d, i) => (
        <JsonLdScript key={i} data={d} />
      ))}
    </>
  );
}

export function NewsFeedJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI Agent News Feed",
    description:
      "Daily-updated news feed for teams building, buying, or operating AI agents with context on execution and trust.",
    url: `${SITE_URL}/news`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    about: [
      "AI agents",
      "multi-agent execution",
      "agent operations",
      "trusted implementation",
    ],
  };

  return <JsonLdScript data={data} />;
}
