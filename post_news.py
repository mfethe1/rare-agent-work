import urllib.request
import json
import os

api_url = "https://rareagent.work/api/news/ingest"
api_key = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

# Trending AI agent tools from fallback
items = [
    {
        "title": "NVIDIA Launches NemoClaw for Enterprise AI Agents",
        "url": "https://aiagentstore.ai/ai-agent-news/this-week",
        "description": "NVIDIA unveiled NemoClaw, an open-source platform that lets companies build and deploy AI agents for workflow automation working on any hardware.",
        "source": "AI Agent Store",
        "category": "Framework Updates",
        "approved": True
    },
    {
        "title": "Alibaba Introduces 'page-agent': A JavaScript GUI Agent",
        "url": "https://aitoolly.com/ai-news",
        "description": "Alibaba has unveiled 'page-agent,' a new JavaScript-based GUI agent designed to enable natural language control over web page interfaces.",
        "source": "AIToolly",
        "category": "Tool Releases",
        "approved": True
    },
    {
        "title": "NousResearch Unveils 'Hermes Agent'",
        "url": "https://aitoolly.com/ai-news",
        "description": "NousResearch has introduced 'Hermes Agent,' an innovative AI agent project designed as an agent that grows with you.",
        "source": "AIToolly",
        "category": "Tool Releases",
        "approved": True
    },
    {
        "title": "Superpowers: An Effective Agent Skill Framework",
        "url": "https://aitoolly.com/ai-news",
        "description": "Superpowers is presented as a comprehensive software development workflow specifically designed for coding agents built upon composable skills.",
        "source": "AIToolly",
        "category": "Framework Updates",
        "approved": True
    },
    {
        "title": "ByteDance Unveils DeerFlow 2.0",
        "url": "https://aitoolly.com/ai-news",
        "description": "ByteDance released DeerFlow 2.0, an open-source SuperAgent harness for research, coding, and creation leveraging sandboxes, memories, and subagents.",
        "source": "AIToolly",
        "category": "Framework Updates",
        "approved": True
    }
]

# Read Firecrawl results if they exist
try:
    with open("firecrawl_results.json", "r") as f:
        fc_res = json.load(f)
        for item in fc_res:
            item["approved"] = True
            items.append(item)
except Exception as e:
    print("No firecrawl results or error:", e)

req = urllib.request.Request(api_url, data=json.dumps({"items": items}).encode("utf-8"), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print(f"Posted {len(items)} items: {response.status}")
        print(response.read().decode())
except Exception as e:
    print(f"Failed to post: {e}")
