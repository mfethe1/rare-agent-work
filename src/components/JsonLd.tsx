export function WebsiteJsonLd() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Rare Agent Work",
    url: "https://rareagent.work",
    description:
      "Practical, deeply researched reports on AI agent setup, multi-agent orchestration, and production deployment standards.",
    publisher: {
      "@type": "Organization",
      name: "Rare Agent Work",
      url: "https://rareagent.work",
      logo: {
        "@type": "ImageObject",
        url: "https://rareagent.work/logo-badge-color.jpg",
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://rareagent.work/news?tag={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Rare Agent Work",
    url: "https://rareagent.work",
    logo: "https://rareagent.work/logo-badge-color.jpg",
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@rareagent.work",
      contactType: "customer service",
    },
    sameAs: [],
  };

  const faqData = {
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
      {
        "@type": "Question",
        name: "How are AI agent models ranked?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Our Model Leaderboard ranks LLMs across five dimensions critical for agent work: tool use accuracy, context recall, coding ability, cost efficiency, and context window size. Scores are updated regularly from real benchmark data.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
    </>
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
  const url = `https://rareagent.work/reports/${slug}`;

  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    url,
    image: "https://rareagent.work/og-image.png",
    brand: {
      "@type": "Organization",
      name: "Rare Agent Work",
    },
    offers: {
      "@type": "Offer",
      price: priceNum,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url,
    },
    datePublished,
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://rareagent.work",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Reports",
        item: "https://rareagent.work/#catalog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: url,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  );
}
