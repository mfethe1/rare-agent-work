import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Add Link header to all pages for llms.txt discoverability
        source: "/((?!api|_next|favicon).*)",
        headers: [
          {
            key: "Link",
            value:
              '<https://rareagent.work/llms.txt>; rel="ai-content-index", <https://rareagent.work/.well-known/agent.json>; rel="agent-card"',
          },
        ],
      },
      {
        // CORS for public API endpoints
        source: "/api/:path(news|models|reports|digest|openapi\\.json)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        // CORS for NLWeb /ask endpoint
        source: "/ask",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
