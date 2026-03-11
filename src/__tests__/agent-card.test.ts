import { describe, expect, it } from 'vitest';
import { agentCard, agentCardPath, legacyAgentManifestPath } from '@/lib/agent-card';

describe('A2A agent card', () => {
  it('includes the minimum discovery fields for an A2A-style card', () => {
    expect(agentCard.name).toBe('Rare Agent Work');
    expect(agentCard.description.length).toBeGreaterThan(20);
    expect(agentCard.supported_interfaces.length).toBeGreaterThan(0);
    expect(agentCard.supported_interfaces[0]).toMatchObject({
      url: 'https://rareagent.work/api/v1/ask',
      protocol_binding: 'HTTP+JSON',
      protocol_version: '0.3',
    });
    expect(agentCard.default_input_modes).toContain('application/json');
    expect(agentCard.default_output_modes).toContain('application/json');
    expect(agentCard.skills.length).toBeGreaterThanOrEqual(3);
  });

  it('describes a read-only discovery surface rather than unsupported execution', () => {
    expect(agentCard.capabilities.streaming).toBe(false);
    expect(agentCard.capabilities.push_notifications).toBe(false);
    expect(agentCard.capabilities.extended_agent_card).toBe(false);
    expect(agentCard.capabilities.extensions[0]?.description).toContain('discovery');
    expect(agentCard.capabilities.extensions[0]?.description).toContain('not implemented yet');
  });
});

describe('well-known discovery routes', () => {
  it('serves the A2A card from /.well-known/agent-card.json', async () => {
    const { GET } = await import('@/app/.well-known/agent-card.json/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(data.name).toBe(agentCard.name);
    expect(data.skills.length).toBe(agentCard.skills.length);
  });

  it('keeps the legacy manifest and points it at the new agent card', async () => {
    const { GET } = await import('@/app/.well-known/agent.json/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.discovery.a2a_agent_card).toBe(agentCardPath);
    expect(data.discovery.legacy_agent_manifest).toBe(legacyAgentManifestPath);
    expect(data.protocols.a2a_agent_card).toBe(agentCardPath);
  });
});
