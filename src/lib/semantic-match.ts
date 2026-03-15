/**
 * Semantic Capability Matching
 * Handles synonym expansion and partial matching so "ml" matches "machine-learning".
 * Round 36
 */

// ─── Synonym map ───────────────────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, string[]> = {
  "ml": ["machine-learning", "machine learning", "deep-learning", "deep learning"],
  "ai": ["artificial-intelligence", "artificial intelligence", "machine-learning", "ml"],
  "security": ["cybersecurity", "infosec", "security-audit", "penetration-testing", "appsec"],
  "code-review": ["code review", "pr-review", "pull-request-review", "code-audit"],
  "nlp": ["natural-language-processing", "natural language processing", "text-analysis", "text analysis", "llm"],
  "cv": ["computer-vision", "computer vision", "image-analysis", "image analysis", "object-detection"],
  "devops": ["infrastructure", "ci-cd", "deployment", "kubernetes", "docker", "sre", "platform-engineering"],
  "data": ["data-analysis", "data analysis", "data-science", "data science", "analytics", "etl", "data-engineering"],
  "frontend": ["ui", "ux", "react", "web-development", "web development", "vue", "angular", "nextjs", "tailwind"],
  "backend": ["api", "server", "microservices", "rest", "graphql", "node", "python", "go", "rust"],
  "testing": ["qa", "quality-assurance", "unit-testing", "integration-testing", "e2e", "playwright", "jest"],
  "blockchain": ["web3", "solidity", "smart-contracts", "ethereum", "defi", "crypto"],
  "cloud": ["aws", "gcp", "azure", "cloud-computing", "serverless", "lambda"],
  "mobile": ["ios", "android", "react-native", "flutter", "swift", "kotlin"],
  "database": ["sql", "nosql", "postgres", "mongodb", "redis", "elasticsearch"],
  "research": ["literature-review", "analysis", "survey", "benchmarking", "evaluation"],
  "writing": ["technical-writing", "documentation", "copywriting", "content", "markdown"],
  "design": ["ui-design", "ux-design", "figma", "product-design", "visual-design"],
  "finance": ["quantitative-finance", "fintech", "trading", "risk", "options", "algorithmic-trading"],
};

// Build reverse index: synonym → canonical key
const REVERSE_MAP = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
  REVERSE_MAP.set(canonical.toLowerCase(), canonical);
  for (const syn of synonyms) {
    REVERSE_MAP.set(syn.toLowerCase(), canonical);
  }
}

/**
 * Normalize a skill string to its canonical form (or the original if unknown).
 */
export function canonicalize(skill: string): string {
  const norm = skill.toLowerCase().trim();
  return REVERSE_MAP.get(norm) ?? norm;
}

/**
 * Expand a skill to its full synonym set, always including itself.
 */
export function expandSkill(skill: string): Set<string> {
  const canonical = canonicalize(skill);
  const result = new Set<string>([skill.toLowerCase().trim(), canonical]);
  const synonyms = SYNONYM_MAP[canonical];
  if (synonyms) {
    for (const s of synonyms) result.add(s.toLowerCase());
  }
  return result;
}

/**
 * Check whether two skills are semantically equivalent (synonym-aware).
 */
export function skillsMatch(a: string, b: string): boolean {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return true;

  const canonA = canonicalize(normA);
  const canonB = canonicalize(normB);
  if (canonA === canonB) return true;

  // Substring / partial match
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Cross-expand check
  const expandedA = expandSkill(normA);
  if (expandedA.has(normB) || expandedA.has(canonB)) return true;
  const expandedB = expandSkill(normB);
  if (expandedB.has(normA) || expandedB.has(canonA)) return true;

  return false;
}

/**
 * Compute a semantic skill match score (0-1) between a required set and an available set.
 * Uses synonym expansion + partial matching; returns normalized intersection / required size.
 */
export function semanticSkillMatch(required: string[], available: string[]): number {
  if (required.length === 0 && available.length === 0) return 1;
  if (required.length === 0) return 1; // no requirements → perfect match
  if (available.length === 0) return 0;

  let matchedCount = 0;

  for (const req of required) {
    let matched = false;
    for (const avail of available) {
      if (skillsMatch(req, avail)) {
        matched = true;
        break;
      }
    }
    if (matched) matchedCount++;
  }

  // Score = fraction of required skills that are covered
  return matchedCount / required.length;
}

/**
 * Return which required skills are missing from available (semantic-aware).
 */
export function missingSkills(required: string[], available: string[]): string[] {
  return required.filter(
    (req) => !available.some((avail) => skillsMatch(req, avail)),
  );
}
