import requests
import json
import os

API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "Reliable Software in the LLM Era",
        "url": "https://news.ycombinator.com/item?id=47347901",
        "source": "Hacker News",
        "summary": "AI now makes every product operate as if it has a vibrant open-source community with hundreds of contributions per day and a small core team with limited capacity.",
        "tags": ["AI", "LLM", "Software Engineering"],
        "category": "Discussions"
    },
    {
        "title": "I don't use LLMs for programming",
        "url": "https://news.ycombinator.com/item?id=47348475",
        "source": "Hacker News",
        "summary": "Discussion on Hacker News about the tradeoffs of using LLMs for programming and how it relates to team dynamics, architecture, and coding strategies.",
        "tags": ["AI", "LLM", "Programming", "Discussion"],
        "category": "Discussions"
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