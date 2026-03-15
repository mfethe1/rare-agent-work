import path from "node:path";
import { JsonFileStore } from "./data-store";

const ENTITIES_FILE = path.join(process.cwd(), "data/knowledge/entities.json");
const store = new JsonFileStore<Entity>(ENTITIES_FILE);

export type EntityType = "framework" | "vendor" | "model" | "benchmark" | "incident" | "regulation";
export type RelationType = "uses" | "competes_with" | "depends_on" | "benchmarked_by" | "affected_by" | "created_by";

export interface Relation {
  target_id: string;
  type: RelationType;
  weight?: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  properties: Record<string, unknown>;
  relations: Relation[];
  updated_at: string;
}

// ─── Seeded knowledge graph ───────────────────────────────────────────────────

const SEED_ENTITIES: Entity[] = [
  // Frameworks
  {
    id: "fw-langchain",
    type: "framework",
    name: "LangChain",
    description: "A framework for developing applications powered by language models, enabling chaining of LLM calls with tools and memory.",
    properties: { language: "Python/JS", open_source: true, github: "langchain-ai/langchain" },
    relations: [
      { target_id: "v-openai", type: "uses", weight: 0.9 },
      { target_id: "v-anthropic", type: "uses", weight: 0.8 },
      { target_id: "fw-crewai", type: "competes_with", weight: 0.7 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "fw-crewai",
    type: "framework",
    name: "CrewAI",
    description: "A framework for orchestrating role-playing autonomous AI agents that collaborate to accomplish complex tasks.",
    properties: { language: "Python", open_source: true, github: "crewAIInc/crewAI" },
    relations: [
      { target_id: "fw-langchain", type: "depends_on", weight: 0.5 },
      { target_id: "fw-autogen", type: "competes_with", weight: 0.8 },
      { target_id: "v-openai", type: "uses", weight: 0.8 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "fw-autogen",
    type: "framework",
    name: "AutoGen",
    description: "Microsoft's framework for building LLM applications using multiple agents that converse to solve tasks.",
    properties: { language: "Python", open_source: true, github: "microsoft/autogen", vendor: "Microsoft" },
    relations: [
      { target_id: "v-microsoft", type: "created_by", weight: 1.0 },
      { target_id: "fw-crewai", type: "competes_with", weight: 0.8 },
      { target_id: "v-openai", type: "uses", weight: 0.9 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "fw-mcp",
    type: "framework",
    name: "Model Context Protocol (MCP)",
    description: "Anthropic's open protocol for connecting AI assistants to data sources and tools in a standardized way.",
    properties: { language: "JSON-RPC", open_source: true, spec: "modelcontextprotocol.io" },
    relations: [
      { target_id: "v-anthropic", type: "created_by", weight: 1.0 },
      { target_id: "fw-a2a", type: "competes_with", weight: 0.6 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "fw-a2a",
    type: "framework",
    name: "Agent-to-Agent (A2A)",
    description: "Google's open protocol for agent interoperability, enabling AI agents from different vendors to communicate and collaborate.",
    properties: { open_source: true, spec: "google.github.io/A2A" },
    relations: [
      { target_id: "v-google", type: "created_by", weight: 1.0 },
      { target_id: "fw-mcp", type: "competes_with", weight: 0.6 },
    ],
    updated_at: new Date().toISOString(),
  },
  // Vendors
  {
    id: "v-openai",
    type: "vendor",
    name: "OpenAI",
    description: "AI research company behind GPT models, ChatGPT, and the DALL-E image generation system.",
    properties: { founded: 2015, hq: "San Francisco", models: ["GPT-4", "GPT-4o", "o1", "o3"] },
    relations: [
      { target_id: "v-anthropic", type: "competes_with", weight: 0.9 },
      { target_id: "v-google", type: "competes_with", weight: 0.9 },
      { target_id: "m-gpt4o", type: "created_by", weight: 1.0 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "v-anthropic",
    type: "vendor",
    name: "Anthropic",
    description: "AI safety company that created Claude, focused on building reliable, interpretable, and steerable AI systems.",
    properties: { founded: 2021, hq: "San Francisco", models: ["Claude 3", "Claude 3.5", "Claude 4"] },
    relations: [
      { target_id: "v-openai", type: "competes_with", weight: 0.9 },
      { target_id: "m-claude", type: "created_by", weight: 1.0 },
      { target_id: "fw-mcp", type: "created_by", weight: 1.0 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "v-google",
    type: "vendor",
    name: "Google DeepMind",
    description: "Google's AI research division responsible for Gemini models and AlphaCode, AlphaFold, and related projects.",
    properties: { parent: "Alphabet", models: ["Gemini Ultra", "Gemini Pro", "Gemma"] },
    relations: [
      { target_id: "v-openai", type: "competes_with", weight: 0.9 },
      { target_id: "m-gemini", type: "created_by", weight: 1.0 },
      { target_id: "fw-a2a", type: "created_by", weight: 1.0 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "v-meta",
    type: "vendor",
    name: "Meta AI",
    description: "Meta's AI research division responsible for the Llama open-source model family and related research.",
    properties: { parent: "Meta Platforms", models: ["Llama 2", "Llama 3", "Llama 3.1"] },
    relations: [
      { target_id: "v-openai", type: "competes_with", weight: 0.7 },
      { target_id: "m-llama", type: "created_by", weight: 1.0 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "v-microsoft",
    type: "vendor",
    name: "Microsoft",
    description: "Technology company partnered with OpenAI, integrating AI into Azure cloud services and Copilot products.",
    properties: { hq: "Redmond", investment_in_openai: true },
    relations: [
      { target_id: "v-openai", type: "uses", weight: 0.9 },
      { target_id: "fw-autogen", type: "created_by", weight: 1.0 },
    ],
    updated_at: new Date().toISOString(),
  },
  // Models
  {
    id: "m-gpt4o",
    type: "model",
    name: "GPT-4o",
    description: "OpenAI's multimodal flagship model with vision, audio, and text capabilities at improved speed and cost.",
    properties: { modalities: ["text", "vision", "audio"], context_window: 128000, vendor: "OpenAI" },
    relations: [
      { target_id: "v-openai", type: "created_by", weight: 1.0 },
      { target_id: "m-claude", type: "competes_with", weight: 0.9 },
      { target_id: "m-gemini", type: "competes_with", weight: 0.9 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "m-claude",
    type: "model",
    name: "Claude 3.5 Sonnet",
    description: "Anthropic's most capable model balancing intelligence and speed, with strong coding and reasoning capabilities.",
    properties: { context_window: 200000, vendor: "Anthropic", benchmark_mmlu: 88.7 },
    relations: [
      { target_id: "v-anthropic", type: "created_by", weight: 1.0 },
      { target_id: "m-gpt4o", type: "competes_with", weight: 0.9 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "m-gemini",
    type: "model",
    name: "Gemini 1.5 Pro",
    description: "Google's multimodal model with a 1M token context window, capable of processing long documents, video, and audio.",
    properties: { context_window: 1000000, modalities: ["text", "vision", "audio", "video"], vendor: "Google" },
    relations: [
      { target_id: "v-google", type: "created_by", weight: 1.0 },
      { target_id: "m-gpt4o", type: "competes_with", weight: 0.9 },
      { target_id: "m-claude", type: "competes_with", weight: 0.9 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "m-llama",
    type: "model",
    name: "Llama 3.1",
    description: "Meta's open-source large language model available in 8B, 70B, and 405B parameter sizes.",
    properties: { open_source: true, sizes: ["8B", "70B", "405B"], vendor: "Meta" },
    relations: [
      { target_id: "v-meta", type: "created_by", weight: 1.0 },
      { target_id: "m-gpt4o", type: "competes_with", weight: 0.7 },
    ],
    updated_at: new Date().toISOString(),
  },
  // Benchmarks
  {
    id: "bm-mmlu",
    type: "benchmark",
    name: "MMLU",
    description: "Massive Multitask Language Understanding — a benchmark testing knowledge across 57 subjects including STEM, humanities, and social sciences.",
    properties: { tasks: 57, categories: ["academic", "professional"] },
    relations: [
      { target_id: "m-gpt4o", type: "benchmarked_by", weight: 0.9 },
      { target_id: "m-claude", type: "benchmarked_by", weight: 0.9 },
      { target_id: "m-gemini", type: "benchmarked_by", weight: 0.9 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "bm-humaneval",
    type: "benchmark",
    name: "HumanEval",
    description: "OpenAI's coding benchmark testing the ability to synthesize programs from docstrings — a standard for evaluating code generation.",
    properties: { problems: 164, language: "Python" },
    relations: [
      { target_id: "m-gpt4o", type: "benchmarked_by", weight: 0.8 },
      { target_id: "m-claude", type: "benchmarked_by", weight: 0.8 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: "bm-swebench",
    type: "benchmark",
    name: "SWE-bench",
    description: "A benchmark for evaluating AI systems on real-world GitHub software engineering tasks — fixing bugs in open-source repos.",
    properties: { tasks: 2294, source: "GitHub issues" },
    relations: [
      { target_id: "m-claude", type: "benchmarked_by", weight: 0.9 },
      { target_id: "m-gpt4o", type: "benchmarked_by", weight: 0.8 },
    ],
    updated_at: new Date().toISOString(),
  },
  // Regulations
  {
    id: "reg-eu-ai-act",
    type: "regulation",
    name: "EU AI Act",
    description: "The European Union's comprehensive regulation for artificial intelligence, establishing risk-based rules for AI systems.",
    properties: { jurisdiction: "European Union", enacted: "2024", effective: "2026" },
    relations: [
      { target_id: "v-openai", type: "affected_by", weight: 0.8 },
      { target_id: "v-anthropic", type: "affected_by", weight: 0.8 },
      { target_id: "v-google", type: "affected_by", weight: 0.8 },
    ],
    updated_at: new Date().toISOString(),
  },
];

// ─── Initialize store with seed data if empty ─────────────────────────────────

let initialized = false;

async function ensureSeeded(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const existing = await store.getAll();
  if (existing.length === 0) {
    for (const entity of SEED_ENTITIES) {
      await store.create(entity);
    }
  }
}

// ─── Text search helpers ───────────────────────────────────────────────────────

function scoreEntity(entity: Entity, query: string): number {
  const q = query.toLowerCase();
  let score = 0;

  if (entity.name.toLowerCase().includes(q)) score += 3;
  if (entity.description.toLowerCase().includes(q)) score += 1;
  if (entity.type.toLowerCase().includes(q)) score += 2;

  const propsStr = JSON.stringify(entity.properties).toLowerCase();
  if (propsStr.includes(q)) score += 0.5;

  return score;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function queryEntities(
  query: string,
  types?: EntityType[],
  limit = 10,
): Promise<Array<Entity & { relevance_score: number }>> {
  await ensureSeeded();
  const entities = await store.getAll();

  let filtered = types && types.length > 0
    ? entities.filter((e) => types.includes(e.type))
    : entities;

  const scored = filtered
    .map((e) => ({ ...e, relevance_score: scoreEntity(e, query) }))
    .filter((e) => e.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  return scored.slice(0, Math.min(limit, 50));
}

export async function getEntityById(id: string): Promise<Entity | null> {
  await ensureSeeded();
  return store.getById(id);
}

export async function getEntityWithRelations(
  id: string,
): Promise<(Entity & { related_entities: Entity[] }) | null> {
  await ensureSeeded();
  const entity = await store.getById(id);
  if (!entity) return null;

  const all = await store.getAll();
  const entityMap = new Map(all.map((e) => [e.id, e]));

  const related = entity.relations
    .map((r) => entityMap.get(r.target_id))
    .filter((e): e is Entity => e !== undefined);

  return { ...entity, related_entities: related };
}

export async function getSubgraph(
  rootId: string,
  depth: 1 | 2 | 3,
): Promise<{ nodes: Entity[]; edges: Array<{ source: string; target: string; type: string; weight?: number }> }> {
  await ensureSeeded();
  const all = await store.getAll();
  const entityMap = new Map(all.map((e) => [e.id, e]));

  const visitedIds = new Set<string>();
  const nodeIds = new Set<string>();
  const edges: Array<{ source: string; target: string; type: string; weight?: number }> = [];

  function traverse(id: string, currentDepth: number) {
    if (currentDepth > depth || visitedIds.has(id)) return;
    visitedIds.add(id);
    nodeIds.add(id);

    const entity = entityMap.get(id);
    if (!entity) return;

    for (const rel of entity.relations) {
      edges.push({ source: id, target: rel.target_id, type: rel.type, weight: rel.weight });
      nodeIds.add(rel.target_id);
      traverse(rel.target_id, currentDepth + 1);
    }
  }

  traverse(rootId, 0);

  const nodes = Array.from(nodeIds)
    .map((id) => entityMap.get(id))
    .filter((e): e is Entity => e !== undefined);

  return { nodes, edges };
}
