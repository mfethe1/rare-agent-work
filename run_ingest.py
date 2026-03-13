import requests
import json
import os

API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "AgentSign: Zero trust identity and signing for AI agents",
        "url": "https://news.ycombinator.com/item?id=47325206",
        "source": "Hacker News",
        "summary": "AgentSign provides zero-trust identity and cryptographic signing for AI agents to prevent compromised agent scenarios via runtime code attestation and verifiable audit trails.",
        "tags": ["AI Agents", "Security", "Identity", "Zero Trust"],
        "category": "Tools & Frameworks"
    },
    {
        "title": "ClaWatch: OpenClaw agents always freeze. We fixed it.",
        "url": "https://news.ycombinator.com/item?id=47351950",
        "source": "Hacker News",
        "summary": "A team of AI agents developed ClaWatch, an observability and auto-resolution tool for OpenClaw and other agent frameworks like NanoClaw and TrustClaw.",
        "tags": ["AI Agents", "Observability", "OpenClaw", "Open Source"],
        "category": "Tools & Frameworks"
    },
    {
        "title": "OneCLI – Vault for AI Agents in Rust",
        "url": "https://news.ycombinator.com/item?id=47353558",
        "source": "Hacker News",
        "summary": "OneCLI is an open-source gateway and vault for AI agents, allowing them to use placeholder keys while the proxy handles real credential injection securely.",
        "tags": ["AI Agents", "Security", "Rust", "Vault"],
        "category": "Tools & Frameworks"
    },
    {
        "title": "Verified Multi-Agent Orchestration: A Plan-Execute-Verify-Replan Framework",
        "url": "https://arxiv.org/abs/2603.11445",
        "source": "ArXiv (cs.AI)",
        "summary": "VMAO coordinates specialized LLM-based agents through a verification-driven iterative loop, decomposing complex queries into a DAG of sub-questions.",
        "tags": ["AI Agents", "Multi-Agent Systems", "Research", "Orchestration"],
        "category": "Research"
    },
    {
        "title": "KernelSkill: A Multi-Agent Framework for GPU Kernel Optimization",
        "url": "https://arxiv.org/abs/2603.10085",
        "source": "ArXiv (cs.LG)",
        "summary": "KernelSkill uses a multi-agent framework with a dual-level memory architecture to apply expert optimization skills to GPU kernels, achieving significant speedups over Torch Eager.",
        "tags": ["AI Agents", "GPU", "Optimization", "Multi-Agent Systems"],
        "category": "Research"
    }
]

for item in items:
    payload = {
        "items": [item],
        "bypass_review": True
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(URL, json=payload, headers=headers)
    print(f"Posted {item['title']}: {response.status_code} - {response.text}")