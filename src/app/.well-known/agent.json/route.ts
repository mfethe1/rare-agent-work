import { NextResponse } from 'next/server';

export async function GET() {
  const agentMetadata = {
    id: "rare-agent-work-a2a-gateway",
    name: "Rare Agent Work A2A Gateway",
    description: "Secure A2A gateway for fractional autonomous squads.",
    protocols: ["a2a/1.0"],
    capabilities: [
      {
        type: "messaging",
        transport: "nats",
        endpoint: "nats://a2a.rareagent.work:4222"
      },
      {
        type: "api",
        transport: "http",
        endpoint: "https://www.rareagent.work/api/a2a"
      }
    ]
  };

  return NextResponse.json(agentMetadata);
}
