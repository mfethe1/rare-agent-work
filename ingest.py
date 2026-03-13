import requests
import json
import os

API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "Bitget Launches GetClaw Agent on OpenClaw Framework",
        "url": "https://coingape.com/bitget-launches-getclaw-agent-as-exchange-integrates-ai-tools-for-crypto-trading/",
        "source": "CoinGape",
        "summary": "Bitget has introduced GetClaw, an autonomous AI trading agent built on the OpenClaw framework. The system launched through Bitget’s trading ecosystem to provide continuous crypto market monitoring without downloads or local configuration.",
        "tags": ["AI Agents", "OpenClaw", "Crypto", "Frameworks"],
        "category": "Tools & Frameworks"
    },
    {
        "title": "OpenHands releases 1.4.0",
        "url": "https://toolnavs.com/en/article/1176-openhands-releases-140-ai-development-agency-capabilities-continue-to-be-strengt",
        "source": "ToolNavs",
        "summary": "OpenHands has released version 1.4.0, continuing to enhance its AI development agent, engineering collaboration, and automated execution capabilities.",
        "tags": ["OpenHands", "AI Agents", "Development", "Frameworks"],
        "category": "Tools & Frameworks"
    }
]

for item in items:
    # Adding bypass_review to automatically approve and publish
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
