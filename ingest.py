import json
import urllib.request
import urllib.error

API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "New AI Agent Framework: AgentX with Multi-Step Verification",
        "url": "https://fixmyaipro.blogspot.com/2026/03/new-ai-agent-frameworks-march-2026.html?m=1",
        "content": "AgentX released with a 'Multi-Step Verification' system to check code before execution and fix loops. Ollama 2026 integration updates also automate CORS configuration.",
        "source": "FixMyAIPro",
        "category": "frameworks",
        "status": "published",
        "approved": True
    },
    {
        "title": "Google ADK (Agent Development Kit) Released",
        "url": "https://harness-engineering.ai/blog/daily-ai-agent-news-roundup-march-11-2026/",
        "content": "Google released the Agent Development Kit (ADK), providing a comprehensive framework for building AI agents and workflows from scratch.",
        "source": "Google / Harness Engineering",
        "category": "frameworks",
        "status": "published",
        "approved": True
    },
    {
        "title": "OpenAI GPT-5.4 Tool Search Feature",
        "url": "https://www.youtube.com/watch?v=LvS2DWCfQXQ",
        "content": "OpenAI introduces GPT-5.4 Tool Search, cutting token costs for tool-heavy workflows by 50% and shipping with a 1 million token context window and native computer use.",
        "source": "AI Model News",
        "category": "tools",
        "status": "published",
        "approved": True
    }
]

for item in items:
    data = json.dumps({"items": [item]}).encode('utf-8')
    req = urllib.request.Request(URL, data=data, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    })
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Ingested: {item['title']} - Status: {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"Failed to ingest: {item['title']} - Status: {e.code} - {e.read().decode()}")
