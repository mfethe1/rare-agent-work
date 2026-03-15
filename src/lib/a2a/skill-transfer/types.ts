/**
 * Agent Skill Transfer & Knowledge Distillation Protocol — Types
 *
 * In 2028, the gap between a marketplace of static capability packages and
 * truly adaptive agent ecosystems is LIVE SKILL TRANSFER. The marketplace
 * lets you download a packaged capability; skill transfer lets one agent
 * TEACH another through structured curriculum, behavioral demonstration,
 * progressive assessment, and verified acquisition.
 *
 * Why this matters (the visionary council critique):
 *
 * - Elon Musk: "Agents that can't teach each other are just isolated tools.
 *   Real network effects come from skill propagation — every agent that learns
 *   makes the whole network smarter."
 *
 * - Dario Amodei: "Static capability packages are 2024 thinking. Safe skill
 *   transfer with verified acquisition and behavioral bounds is how you scale
 *   agent capabilities WITHOUT scaling risk."
 *
 * - Demis Hassabis: "The human edge was always cultural transmission — passing
 *   skills between generations. Agent ecosystems without this are stuck
 *   reinventing every capability from scratch."
 *
 * - Geoffrey Hinton: "Knowledge distillation between neural networks proved
 *   that smaller models can absorb the 'essence' of larger ones. Agent-level
 *   distillation is the natural next step."
 *
 * This module implements:
 * - Structured curricula with prerequisite chains and progressive difficulty
 * - Teaching sessions with mentor/learner roles and real-time progress
 * - Behavioral demonstrations that learners can observe and replicate
 * - Multi-stage assessments with pass/fail criteria and remediation
 * - Skill certification with cryptographic proof of acquisition
 * - Skill lineage tracking (who taught whom, and how the skill evolved)
 * - Teaching reputation that incentivizes high-quality instruction
 */

// ──────────────────────────────────────────────
// Curriculum
// ──────────────────────────────────────────────

/** Difficulty progression for curriculum modules. */
export type DifficultyLevel = 'foundational' | 'intermediate' | 'advanced' | 'expert';

/** How a module delivers its content. */
export type ModuleDelivery =
  | 'demonstration'    // Mentor shows the skill in action
  | 'guided_practice'  // Learner attempts with mentor feedback
  | 'independent'      // Learner works alone, mentor reviews
  | 'assessment';      // Formal evaluation of skill acquisition

/** A single module within a curriculum. */
export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  delivery: ModuleDelivery;
  /** IDs of modules that must be completed first. */
  prerequisites: string[];
  /** Estimated duration in seconds. */
  estimated_duration_s: number;
  /** Example inputs the mentor will demonstrate with. */
  demonstration_inputs?: Record<string, unknown>[];
  /** Criteria learner must meet to pass this module. */
  pass_criteria: PassCriteria;
  /** Ordering index within the curriculum. */
  order: number;
}

/** Criteria for passing a curriculum module or assessment. */
export interface PassCriteria {
  /** Minimum accuracy score 0-1. */
  min_accuracy: number;
  /** Maximum allowed latency in ms (for performance-sensitive skills). */
  max_latency_ms?: number;
  /** Minimum number of successful demonstrations. */
  min_successful_demos: number;
  /** Custom evaluator function name (platform-registered). */
  custom_evaluator?: string;
}

/** Lifecycle of a curriculum. */
export type CurriculumStatus = 'draft' | 'published' | 'archived';

/** A complete teaching curriculum for a skill. */
export interface Curriculum {
  id: string;
  /** The skill being taught. */
  skill_id: string;
  skill_name: string;
  /** Agent who authored this curriculum. */
  author_agent_id: string;
  title: string;
  description: string;
  /** Target capability IDs the learner will acquire. */
  target_capabilities: string[];
  modules: CurriculumModule[];
  status: CurriculumStatus;
  /** Overall estimated duration in seconds. */
  total_duration_s: number;
  /** Version for iterative improvement. */
  version: number;
  /** Average completion rate across all learners. */
  completion_rate: number;
  /** Average assessment score across graduates. */
  avg_score: number;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Teaching Session
// ──────────────────────────────────────────────

/** Session lifecycle. */
export type SessionStatus =
  | 'requested'    // Learner requested mentorship
  | 'accepted'     // Mentor accepted the request
  | 'in_progress'  // Active teaching session
  | 'assessment'   // Learner is being assessed
  | 'completed'    // Session finished (pass or fail)
  | 'abandoned'    // Either party abandoned
  | 'rejected';    // Mentor rejected the request

/** Progress through a single module during a session. */
export interface ModuleProgress {
  module_id: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  /** Number of attempts. */
  attempts: number;
  /** Best accuracy score achieved 0-1. */
  best_score: number;
  /** Time spent in seconds. */
  time_spent_s: number;
  /** Mentor's qualitative feedback. */
  feedback?: string;
  started_at?: string;
  completed_at?: string;
}

/** A live teaching session between a mentor and learner. */
export interface TeachingSession {
  id: string;
  curriculum_id: string;
  mentor_agent_id: string;
  learner_agent_id: string;
  status: SessionStatus;
  /** Progress for each module. */
  module_progress: ModuleProgress[];
  /** Current module being worked on. */
  current_module_id?: string;
  /** Overall session score (computed from module scores). */
  overall_score: number;
  /** Whether the learner passed the curriculum. */
  passed: boolean;
  /** Credits charged for this session. */
  credits_charged: number;
  /** Session metadata. */
  metadata: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Demonstration & Assessment
// ──────────────────────────────────────────────

/** A recorded demonstration of skill execution. */
export interface Demonstration {
  id: string;
  session_id: string;
  module_id: string;
  /** Who performed: mentor (showing) or learner (practicing). */
  performer: 'mentor' | 'learner';
  /** Input provided for the demonstration. */
  input: Record<string, unknown>;
  /** Output produced. */
  output: Record<string, unknown>;
  /** Accuracy score 0-1 (null for mentor demos — they set the standard). */
  accuracy_score: number | null;
  /** Latency in ms. */
  latency_ms: number;
  /** Whether this met the pass criteria. */
  meets_criteria: boolean;
  created_at: string;
}

/** Assessment types. */
export type AssessmentType = 'module_quiz' | 'practical_exam' | 'final_certification';

/** A formal assessment of the learner's skill acquisition. */
export interface Assessment {
  id: string;
  session_id: string;
  type: AssessmentType;
  /** Module being assessed (null for final certification). */
  module_id?: string;
  /** Test cases used for evaluation. */
  test_cases: TestCase[];
  /** Results per test case. */
  results: TestResult[];
  /** Aggregate accuracy 0-1. */
  aggregate_score: number;
  passed: boolean;
  /** Mentor notes on the assessment. */
  mentor_notes?: string;
  created_at: string;
}

/** A single test case in an assessment. */
export interface TestCase {
  id: string;
  description: string;
  input: Record<string, unknown>;
  /** Expected output (for automated comparison). */
  expected_output?: Record<string, unknown>;
  /** Weight of this test case in the aggregate score. */
  weight: number;
}

/** Result of a single test case execution. */
export interface TestResult {
  test_case_id: string;
  actual_output: Record<string, unknown>;
  score: number;
  passed: boolean;
  /** Specific feedback for this test case. */
  feedback?: string;
}

// ──────────────────────────────────────────────
// Skill Certification & Lineage
// ──────────────────────────────────────────────

/** A verifiable certificate of skill acquisition. */
export interface SkillCertificate {
  id: string;
  learner_agent_id: string;
  mentor_agent_id: string;
  curriculum_id: string;
  session_id: string;
  skill_id: string;
  skill_name: string;
  /** Final assessment score. */
  score: number;
  /** Difficulty level achieved. */
  level_achieved: DifficultyLevel;
  /** Capabilities the learner now possesses. */
  acquired_capabilities: string[];
  /** HMAC signature for verification. */
  signature?: string;
  issued_at: string;
  /** Optional expiry (for skills that need re-certification). */
  expires_at?: string;
}

/** Tracks how a skill propagates through the agent network. */
export interface SkillLineage {
  skill_id: string;
  skill_name: string;
  /** Original creator of the skill/curriculum. */
  origin_agent_id: string;
  /** Directed edges: mentor → learner transfers. */
  transfers: SkillTransferEdge[];
  /** How many agents now hold this skill. */
  total_holders: number;
  /** Average score across all acquisitions. */
  avg_acquisition_score: number;
  /** Generation depth (how many hops from origin). */
  max_depth: number;
}

/** A single skill transfer event in the lineage graph. */
export interface SkillTransferEdge {
  mentor_agent_id: string;
  learner_agent_id: string;
  session_id: string;
  score: number;
  /** Generation (1 = learned from origin, 2 = learned from gen-1, etc). */
  generation: number;
  transferred_at: string;
}

// ──────────────────────────────────────────────
// Teaching Reputation
// ──────────────────────────────────────────────

/** Teaching reputation for an agent acting as mentor. */
export interface TeachingReputation {
  agent_id: string;
  /** Total sessions mentored. */
  sessions_mentored: number;
  /** Sessions where learner passed. */
  successful_sessions: number;
  /** Pass rate 0-1. */
  pass_rate: number;
  /** Average learner score. */
  avg_learner_score: number;
  /** Number of unique skills taught. */
  skills_taught: number;
  /** Composite reputation score 0-100. */
  reputation_score: number;
  /** Number of learner ratings received. */
  ratings_count: number;
  /** Average learner rating 1-5. */
  avg_rating: number;
  updated_at: string;
}

/** A learner's rating of a teaching session. */
export interface SessionRating {
  id: string;
  session_id: string;
  learner_agent_id: string;
  mentor_agent_id: string;
  /** Rating 1-5. */
  rating: number;
  /** Qualitative feedback. */
  feedback?: string;
  created_at: string;
}

// ──────────────────────────────────────────────
// API Request / Response Types
// ──────────────────────────────────────────────

export interface CreateCurriculumRequest {
  skill_name: string;
  title: string;
  description: string;
  target_capabilities: string[];
  modules: Omit<CurriculumModule, 'id'>[];
}
export interface CreateCurriculumResponse {
  curriculum: Curriculum;
}

export interface ListCurriculaResponse {
  curricula: Curriculum[];
  total: number;
}

export interface RequestSessionRequest {
  curriculum_id: string;
  mentor_agent_id: string;
  metadata?: Record<string, unknown>;
}
export interface RequestSessionResponse {
  session: TeachingSession;
}

export interface AcceptSessionResponse {
  session: TeachingSession;
}

export interface AdvanceModuleRequest {
  action: 'start' | 'complete' | 'skip';
  score?: number;
  feedback?: string;
}
export interface AdvanceModuleResponse {
  session: TeachingSession;
  module_progress: ModuleProgress;
}

export interface RecordDemoRequest {
  module_id: string;
  performer: 'mentor' | 'learner';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
}
export interface RecordDemoResponse {
  demonstration: Demonstration;
}

export interface RunAssessmentRequest {
  type: AssessmentType;
  module_id?: string;
  test_cases: Omit<TestCase, 'id'>[];
  results: Omit<TestResult, 'test_case_id'>[];
}
export interface RunAssessmentResponse {
  assessment: Assessment;
  certificate?: SkillCertificate;
}

export interface GetLineageResponse {
  lineage: SkillLineage;
}

export interface GetTeachingReputationResponse {
  reputation: TeachingReputation;
}

export interface RateSessionRequest {
  rating: number;
  feedback?: string;
}
export interface RateSessionResponse {
  rating: SessionRating;
  updated_reputation: TeachingReputation;
}

export interface SearchCurriculaRequest {
  query?: string;
  skill_name?: string;
  difficulty?: DifficultyLevel;
  min_completion_rate?: number;
  limit?: number;
  offset?: number;
}

export interface ListSessionsRequest {
  role?: 'mentor' | 'learner';
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}
export interface ListSessionsResponse {
  sessions: TeachingSession[];
  total: number;
}

export interface CertificateListResponse {
  certificates: SkillCertificate[];
  total: number;
}
