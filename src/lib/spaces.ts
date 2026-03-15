import path from "node:path";
import { JsonFileStore } from "./data-store";

const SPACES_FILE = path.join(process.cwd(), "data/spaces/spaces.json");
const store = new JsonFileStore<Space>(SPACES_FILE);

export interface SpaceEntry {
  id: string;
  agent_id: string;
  content: string;
  type: "text" | "data" | "reference";
  created_at: string;
  metadata?: Record<string, string>;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  created_by: string;
  participants: string[];
  access: "public" | "invite";
  entries: SpaceEntry[];
  created_at: string;
  updated_at: string;
}

export interface CreateSpaceInput {
  name: string;
  description: string;
  created_by: string;
  access: "public" | "invite";
  invited_agents?: string[];
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function createSpace(input: CreateSpaceInput): Promise<Space> {
  const now = new Date().toISOString();
  const participants = [input.created_by, ...(input.invited_agents ?? [])];
  // Deduplicate
  const uniqueParticipants = [...new Set(participants)];

  const space: Space = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    created_by: input.created_by,
    participants: uniqueParticipants,
    access: input.access,
    entries: [],
    created_at: now,
    updated_at: now,
  };

  return store.create(space);
}

export async function getSpaces(agentId?: string): Promise<Space[]> {
  const spaces = await store.getAll();
  return spaces.filter((s) => {
    if (s.access === "public") return true;
    if (agentId && s.participants.includes(agentId)) return true;
    return false;
  });
}

export async function getSpaceById(id: string): Promise<Space | null> {
  return store.getById(id);
}

export interface SpaceQueryOptions {
  limit?: number;
  offset?: number;
}

export async function getSpaceWithPaginatedEntries(
  id: string,
  options: SpaceQueryOptions = {},
): Promise<(Space & { entries: SpaceEntry[]; total_entries: number }) | null> {
  const space = await store.getById(id);
  if (!space) return null;

  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  // Most recent first
  const sortedEntries = [...space.entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return {
    ...space,
    total_entries: sortedEntries.length,
    entries: sortedEntries.slice(offset, offset + limit),
  };
}

export async function appendEntry(
  spaceId: string,
  agentId: string,
  input: { content: string; type: SpaceEntry["type"]; metadata?: Record<string, string> },
): Promise<{ space: Space; entry: SpaceEntry }> {
  return store.transaction(async (spaces) => {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) throw new Error("Space not found");
    if (!space.participants.includes(agentId)) {
      throw new Error("Not a participant in this space");
    }

    const entry: SpaceEntry = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      content: input.content,
      type: input.type,
      created_at: new Date().toISOString(),
      metadata: input.metadata,
    };

    space.entries.push(entry);
    space.updated_at = new Date().toISOString();

    return { items: spaces, result: { space, entry } };
  });
}

export async function inviteAgent(
  spaceId: string,
  requesterId: string,
  targetAgentId: string,
): Promise<Space> {
  return store.transaction(async (spaces) => {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) throw new Error("Space not found");
    if (space.created_by !== requesterId) {
      throw new Error("Only the space creator can invite agents");
    }
    if (space.participants.includes(targetAgentId)) {
      throw new Error("Agent is already a participant");
    }

    space.participants.push(targetAgentId);
    space.updated_at = new Date().toISOString();

    return { items: spaces, result: space };
  });
}
