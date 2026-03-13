import os
import json
import requests
from datetime import datetime, timezone

INGEST_API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "Luma launches creative AI agents powered by its new 'Unified Intelligence' models",
        "url": "https://techcrunch.com/2026/03/05/exclusive-luma-launches-creative-ai-agents-powered-by-its-new-unified-intelligence-models/",
        "source": "TechCrunch",
        "date_published": datetime.now(timezone.utc).isoformat(),
        "summary": "Luma introduced Luma Agents, powered by its new Unified Intelligence models, designed to coordinate multiple AI systems and generate end-to-end creative work across text, images, video and audio.",
        "categories": ["agent-frameworks", "tools", "generative-ai"],
        "is_approved": True,
        "status": "published"
    },
    {
        "title": "AWS Bedrock AgentCore Policy and OpenClaw on Amazon Lightsail",
        "url": "https://aws.amazon.com/blogs/aws/aws-weekly-roundup-amazon-connect-health-bedrock-agentcore-policy-gameday-europe-and-more-march-9-2026/",
        "source": "AWS",
        "date_published": datetime.now(timezone.utc).isoformat(),
        "summary": "AWS Bedrock AgentCore Policy is generally available. Also introducing OpenClaw on Amazon Lightsail to run autonomous private AI agents with sandboxed sessions.",
        "categories": ["agent-frameworks", "tools", "aws"],
        "is_approved": True,
        "status": "published"
    },
    {
        "title": "AutoResearch: Karpathy's Autonomous AI Agent Framework",
        "url": "https://www.originxai.com/blog/autonomous-ai-agents-karpathy-autoresearch/",
        "source": "OriginX AI",
        "date_published": datetime.now(timezone.utc).isoformat(),
        "summary": "AutoResearch is an open-source AI agent framework released March 6, 2026 that autonomously runs ML experiments, modifying training scripts and iterating indefinitely.",
        "categories": ["agent-frameworks", "research", "ml"],
        "is_approved": True,
        "status": "published"
    },
    {
        "title": "Nvidia Planning to Launch Open-Source AI Agent Platform",
        "url": "https://www.wired.com/story/nvidia-planning-ai-agent-platform-launch-open-source/",
        "source": "WIRED",
        "date_published": datetime.now(timezone.utc).isoformat(),
        "summary": "Ahead of its annual developer conference, Nvidia is readying a new approach to software that embraces AI agents similar to OpenClaw.",
        "categories": ["agent-frameworks", "tools", "nvidia"],
        "is_approved": True,
        "status": "published"
    },
    {
        "title": "OpenAI Releases Codex Security Agent",
        "url": "https://releasebot.io/updates/openai",
        "source": "OpenAI",
        "date_published": datetime.now(timezone.utc).isoformat(),
        "summary": "OpenAI unveils Codex Security, an application security agent rolling out in research preview to help security teams find and patch vulnerabilities.",
        "categories": ["tools", "security", "agent-frameworks"],
        "is_approved": True,
        "status": "published"
    }
]

def main():
    headers = {
        "Authorization": f"Bearer {INGEST_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Send individually as list might not be supported, or send as a whole list if API expects it
    for item in items:
        # Assuming the API takes single items or batch depending on structure, usually bulk ingest takes an array
        pass

    # Try sending as a list first
    print(f"Sending {len(items)} web search news items...")
    response = requests.post(URL, json={"items": items}, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(response.text)

if __name__ == "__main__":
    main()