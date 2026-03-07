export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Rare Agent Work",
    url: "https://rareagent.work",
    description:
      "Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards.",
    publisher: {
      "@type": "Organization",
      name: "Rare Agent Work",
      url: "https://rareagent.work",
    },
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
    brand: {
      "@type": "Organization",
      name: "Rare Agent Work",
    },
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
