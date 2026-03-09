import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    schema_version: 'v1',
    name_for_human: 'Rare Agent Work',
    name_for_model: 'rare_agent_work',
    description_for_human:
      'Operator-grade AI agent research — reports and curated news for agent builders.',
    description_for_model:
      'Access AI agent research data from Rare Agent Work. Search curated AI agent news and get report previews on multi-agent systems, low-code automation, and agent evaluation methodology. Model index data is currently under review for freshness and methodology. All published data is production-focused.',
    auth: { type: 'none' },
    api: {
      type: 'openapi',
      url: 'https://rareagent.work/api/openapi.json',
    },
    logo_url: 'https://rareagent.work/favicon.ico',
    contact_email: 'hello@rareagent.work',
    legal_info_url: 'https://rareagent.work',
  }, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
