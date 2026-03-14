import json
import urllib.request
import urllib.error

API_KEY = "605c8a47566758cac839012a84c1d651a9d31cddf3a75902"
URL = "https://rareagent.work/api/news/ingest"

items = [
    {
        "title": "How to Detect AI on Reddit - Fighting the Bots | Pangram Labs",
        "url": "https://www.pangram.com/blog/how-to-detect-ai-on-reddit",
        "content": "Reddit AI bot detection tool Pangram Labs Chrome extension released to fight LLM-generated spam on subreddits.",
        "source": "Reddit/Pangram",
        "category": "research",
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
