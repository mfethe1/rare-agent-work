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
