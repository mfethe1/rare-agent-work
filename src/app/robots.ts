import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/"],
        disallow: ["/api/news/", "/api/drafts/", "/api/models/", "/api/usage/", "/api/reports/", "/api/vote/", "/api/articles/", "/api/chat/", "/api/stripe/", "/auth/", "/account/"],
      },
    ],
    sitemap: "https://rareagent.work/sitemap.xml",
  };
}
