import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/news", "/api/models", "/api/reports", "/api/digest", "/api/openapi.json", "/api/v1/"],
        disallow: ["/api/stripe/", "/api/chat/", "/api/usage/", "/api/drafts/", "/api/vote/", "/api/articles/", "/api/news/ingest", "/api/models/update", "/api/reports/generate", "/auth/", "/account/"],
      },
    ],
    sitemap: "https://rareagent.work/sitemap.xml",
  };
}
