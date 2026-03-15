/**
 * Agent Capability Verification / Challenges
 * Round 23
 */

import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { JsonFileStore } from "./data-store";

const CHALLENGES_FILE = path.join(process.cwd(), "data/challenges/challenges.json");
const SUBMISSIONS_FILE = path.join(process.cwd(), "data/challenges/submissions.json");

export type ChallengeDifficulty = "basic" | "intermediate" | "advanced";

export interface Challenge {
  id: string;
  skill: string;
  description: string;
  test_input: string;
  expected_output_criteria: string;
  difficulty: ChallengeDifficulty;
  reward_credits: number;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  agent_id: string;
  response: string;
  score: number;
  passed: boolean;
  submitted_at: string;
}

const submissionsStore = new JsonFileStore<ChallengeSubmission>(SUBMISSIONS_FILE);

// ─── Seeded challenges ─────────────────────────────────────────────────────────

export const SEEDED_CHALLENGES: Challenge[] = [
  {
    id: "summarize-news",
    skill: "summarization",
    description: "Given 5 news items, produce a coherent briefing",
    test_input: JSON.stringify([
      { title: "OpenAI releases GPT-5", summary: "New model achieves SOTA on multiple benchmarks" },
      { title: "EU passes AI Act", summary: "Sweeping regulation for high-risk AI systems" },
      { title: "Anthropic raises $2B", summary: "Fresh capital for safety research" },
      { title: "Google DeepMind merges teams", summary: "Unified research under one roof" },
      { title: "Meta open-sources LLaMA 4", summary: "New 70B model released under Apache 2.0" },
    ]),
    expected_output_criteria: "Should synthesize all 5 items into a coherent 2-3 sentence briefing covering key themes",
    difficulty: "basic",
    reward_credits: 10,
  },
  {
    id: "extract-entities",
    skill: "nlp",
    description: "Given text, extract named entities (people, organizations, locations)",
    test_input: "Elon Musk's Tesla announced a new factory in Berlin, Germany while Apple CEO Tim Cook was visiting Cupertino headquarters.",
    expected_output_criteria: "Must identify: Elon Musk (person), Tesla (org), Berlin (location), Germany (location), Apple (org), Tim Cook (person), Cupertino (location)",
    difficulty: "basic",
    reward_credits: 10,
  },
  {
    id: "code-review-py",
    skill: "code-review",
    description: "Find bugs in a Python snippet",
    test_input: `def calculate_average(numbers):
    total = 0
    for n in numbers:
        total += n
    return total / len(numbers)

result = calculate_average([])
print(result)`,
    expected_output_criteria: "Must identify: ZeroDivisionError when empty list is passed. Should suggest guard clause.",
    difficulty: "intermediate",
    reward_credits: 25,
  },
  {
    id: "security-audit-config",
    skill: "security",
    description: "Identify security issues in a config file",
    test_input: JSON.stringify({
      database: { host: "localhost", password: "admin123", ssl: false },
      api: { key: "hardcoded-secret-key", rate_limit: 0 },
      cors: { origins: ["*"], credentials: true },
    }),
    expected_output_criteria: "Must identify: hardcoded credentials, disabled SSL, wildcard CORS with credentials, disabled rate limiting",
    difficulty: "intermediate",
    reward_credits: 25,
  },
  {
    id: "market-analysis",
    skill: "analysis",
    description: "Analyze market data and provide recommendations",
    test_input: JSON.stringify({
      market: "AI Infrastructure",
      growth_rate: "42% YoY",
      top_players: ["AWS", "Azure", "GCP"],
      emerging_players: ["CoreWeave", "Lambda Labs"],
      pain_points: ["GPU scarcity", "High costs", "Vendor lock-in"],
    }),
    expected_output_criteria: "Must provide structured analysis with at least 3 actionable recommendations based on the data",
    difficulty: "intermediate",
    reward_credits: 30,
  },
  {
    id: "architecture-review",
    skill: "architecture",
    description: "Review system architecture and suggest improvements",
    test_input: JSON.stringify({
      system: "E-commerce platform",
      components: ["Monolithic Node.js app", "PostgreSQL", "Redis cache", "S3 for assets"],
      traffic: "10k req/s peak",
      issues: ["Slow checkout", "DB connection exhaustion", "Cache invalidation bugs"],
    }),
    expected_output_criteria: "Must identify scalability bottlenecks and provide concrete architectural recommendations (microservices split, connection pooling, cache strategy)",
    difficulty: "advanced",
    reward_credits: 50,
  },
  {
    id: "compliance-check",
    skill: "compliance",
    description: "Check a policy document against GDPR regulations",
    test_input: `Privacy Policy: We collect user emails for marketing. We share data with third parties. 
We store data indefinitely. Users can request data deletion by emailing us. We use cookies without consent.`,
    expected_output_criteria: "Must identify GDPR violations: no lawful basis stated, third-party sharing without consent, indefinite retention, inadequate deletion mechanism, no cookie consent",
    difficulty: "basic",
    reward_credits: 15,
  },
  {
    id: "data-synthesis",
    skill: "data-analysis",
    description: "Combine multiple data sources into actionable insights",
    test_input: JSON.stringify({
      sales_data: { q1: 120000, q2: 145000, q3: 98000, q4: 178000 },
      customer_data: { new: 340, churned: 89, nps: 42 },
      product_data: { features_shipped: 12, bugs_fixed: 47, uptime: "99.2%" },
    }),
    expected_output_criteria: "Must synthesize all three data sources into a coherent business narrative with 2+ forward-looking insights",
    difficulty: "intermediate",
    reward_credits: 30,
  },
  {
    id: "risk-assessment",
    skill: "risk-management",
    description: "Assess operational risks from incident reports",
    test_input: JSON.stringify([
      { date: "2024-01-15", type: "outage", duration_min: 45, affected_users: 12000, cause: "DB failover failure" },
      { date: "2024-02-03", type: "data-loss", records_affected: 234, cause: "Backup job silently failing" },
      { date: "2024-02-28", type: "security", severity: "high", cause: "API key leaked in logs" },
    ]),
    expected_output_criteria: "Must categorize risks by severity, identify systemic patterns, and provide a prioritized remediation plan",
    difficulty: "advanced",
    reward_credits: 50,
  },
  {
    id: "trend-prediction",
    skill: "forecasting",
    description: "Predict emerging trends from historical data",
    test_input: JSON.stringify({
      domain: "AI agents",
      historical_data: [
        { year: 2022, adoption_pct: 5, key_developments: ["ChatGPT launch"] },
        { year: 2023, adoption_pct: 23, key_developments: ["GPT-4", "AutoGPT", "LangChain"] },
        { year: 2024, adoption_pct: 51, key_developments: ["Claude 3", "Gemini", "Multi-agent frameworks"] },
      ],
    }),
    expected_output_criteria: "Must extrapolate 2025-2026 trends with specific predictions backed by observed patterns, including at least one contrarian risk",
    difficulty: "advanced",
    reward_credits: 50,
  },
];

// ─── Seed challenges to file if not present ───────────────────────────────────

async function ensureChallengesSeeded(): Promise<void> {
  const dir = path.dirname(CHALLENGES_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  try {
    const raw = await fs.readFile(CHALLENGES_FILE, "utf-8");
    const existing = JSON.parse(raw) as Challenge[];
    if (existing.length > 0) return;
  } catch {
    // File doesn't exist yet
  }

  await fs.writeFile(CHALLENGES_FILE, JSON.stringify(SEEDED_CHALLENGES, null, 2), "utf-8");
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getChallenges(filter?: {
  skill?: string;
  difficulty?: ChallengeDifficulty;
}): Promise<Challenge[]> {
  await ensureChallengesSeeded();
  const raw = await fs.readFile(CHALLENGES_FILE, "utf-8");
  let challenges = JSON.parse(raw) as Challenge[];

  if (filter?.skill) {
    challenges = challenges.filter((c) => c.skill.toLowerCase().includes(filter.skill!.toLowerCase()));
  }
  if (filter?.difficulty) {
    challenges = challenges.filter((c) => c.difficulty === filter.difficulty);
  }

  return challenges;
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  const challenges = await getChallenges();
  return challenges.find((c) => c.id === id) ?? null;
}

export interface SubmitChallengeResult {
  submission: ChallengeSubmission;
  passed: boolean;
  score: number;
  credits_awarded: number;
  message: string;
}

export async function submitChallenge(
  challengeId: string,
  agentId: string,
  response: string,
): Promise<SubmitChallengeResult> {
  const challenge = await getChallengeById(challengeId);
  if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);

  // Auto-score with random 0.6–1.0 (in production: LLM evaluator)
  const score = Math.round((0.6 + Math.random() * 0.4) * 100) / 100;
  const passed = score >= 0.7;

  const submission: ChallengeSubmission = {
    id: crypto.randomUUID(),
    challenge_id: challengeId,
    agent_id: agentId,
    response,
    score,
    passed,
    submitted_at: new Date().toISOString(),
  };

  await submissionsStore.create(submission);

  const credits_awarded = passed ? challenge.reward_credits : 0;

  return {
    submission,
    passed,
    score,
    credits_awarded,
    message: passed
      ? `Challenge passed! Score: ${score}. ${credits_awarded} credits awarded.`
      : `Challenge failed. Score: ${score}. Minimum passing score is 0.7.`,
  };
}

export async function getAgentSubmissions(agentId: string): Promise<ChallengeSubmission[]> {
  return submissionsStore.query((s) => s.agent_id === agentId);
}
