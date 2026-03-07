import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://rareagent.work";
  const now = new Date().toISOString();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/reports/agent-setup-60`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/reports/single-to-multi-agent`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/reports/empirical-agent-architecture`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/models`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/digest`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/research/history`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
