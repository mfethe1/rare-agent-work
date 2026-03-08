import type { MetadataRoute } from "next";
import { getAllReports } from "@/lib/reports";

// Model slugs — keep in sync with seed data in models pages
const MODEL_SLUGS = [
  "gpt-4o",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "gemini-2-5-pro",
  "gpt-4o-mini",
  "llama-3-1-405b",
  "mistral-large-2",
  "deepseek-r1",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://rareagent.work";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/start-here`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/assessment`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/models`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/digest`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/research/history`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    // Agent discovery endpoints
    {
      url: `${baseUrl}/llms.txt`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/llms-full.txt`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/ask`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Dynamic report pages
  const reportPages: MetadataRoute.Sitemap = getAllReports().map((report) => ({
    url: `${baseUrl}/reports/${report.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // Dynamic model detail pages
  const modelPages: MetadataRoute.Sitemap = MODEL_SLUGS.map((slug) => ({
    url: `${baseUrl}/models/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Ads landing pages
  const landingPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/lp/agent-setup`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lp/multi-agent`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];

  return [...staticPages, ...reportPages, ...modelPages, ...landingPages];
}
