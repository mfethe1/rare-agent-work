import urllib.request
import json
import os
import datetime

url = "https://rareagent.work/api/news/ingest"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer 605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
}

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

news_items = [
    {
        "title": "Qwen 3.5 27B running locally beats frontier models on real coding tasks",
        "url": "https://www.youtube.com/watch?v=JDmhvb8X9AY",
        "summary": "Quantized local models in the 27 to 35 billion parameter range are now matching or beating frontier models on real software development tasks at a fraction of the cost. A developer needed a PDF merger app and tried GPT-5 three times without success, but Qwen 3.5 27B running locally on an RTX3090 had a working application in three outputs.",
        "source": "Hacker News / LocalLLaMA",
        "category": "Models",
        "tags": ["local-llm", "qwen", "ai-coding"],
        "publishedAt": now
    },
    {
        "title": "Google publishes 64-page operational playbook for AgentOps",
        "url": "https://www.youtube.com/watch?v=JDmhvb8X9AY#agentops",
        "summary": "Google published a 64-page operational playbook for startups building AI agents. The core thesis is that most projects will fail because teams skip the operational work. They call it AgentOps, detailing four layers of evaluation: component testing, trajectory evaluation, outcome evaluation, and system monitoring.",
        "source": "Web Search",
        "category": "Agents",
        "tags": ["agentops", "google", "ai-agents"],
        "publishedAt": now
    },
    {
        "title": "Anthropic Rolls Out 1 Million Token Context for Claude 4.6 Models",
        "url": "https://aixfunda.substack.com/p/top-llm-rag-and-agent-updates-of-c14",
        "summary": "Anthropic announced that Claude Opus 4.6 and Sonnet 4.6 models now support a full 1 million token context window. Pricing remains steady at $5/$25 per million input/output tokens for Opus and $3/$15 for Sonnet, while media support expands to 600 images or PDF pages per request.",
        "source": "AIxFunda",
        "category": "Models",
        "tags": ["anthropic", "claude", "context-window"],
        "publishedAt": now
    },
    {
        "title": "NVIDIA launches Nemotron 3 Super for multi-agent AI workloads",
        "url": "https://insights.marvin-42.com",
        "summary": "NVIDIA AI Developer introduced Nemotron 3 Super as an open 120B-parameter hybrid MoE model with 12B active parameters and a native 1M-token context window. NVIDIA says the model targets agentic workloads with up to 5x higher throughput than the previous Nemotron Super model.",
        "source": "Insights",
        "category": "Agents",
        "tags": ["nvidia", "nemotron", "multi-agent"],
        "publishedAt": now
    },
    {
        "title": "Google Launches Gemini Embedding 2 for Unified Multimodal AI",
        "url": "https://aixfunda.substack.com/p/top-llm-rag-and-agent-updates-of-c14#gemini",
        "summary": "Google released Gemini Embedding 2, its first model to embed text, images, videos, audio, and PDFs into one shared vector space. It handles up to 8,192 text tokens, six images, 120-second videos, and native audio without transcription.",
        "source": "AIxFunda",
        "category": "Research",
        "tags": ["google", "gemini", "embeddings"],
        "publishedAt": now
    }
]

# Send the whole array as the payload
try:
    data = json.dumps(news_items).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as response:
        print(f"Posted all items: {response.status}")
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Failed to post items: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
