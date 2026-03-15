/**
 * Agent Skill Transfer & Knowledge Distillation — Engine
 *
 * Core business logic for live peer-to-peer skill transfer between agents.
 * All state is in-memory for the protocol layer; persistence is handled
 * by the API routes via Supabase (or any backing store).
 */

import type {
  Curriculum,
  CurriculumModule,
  CurriculumStatus,
  TeachingSession,
  SessionStatus,
  ModuleProgress,
  Demonstration,
  Assessment,
  AssessmentType,
  TestCase,
  TestResult,
  SkillCertificate,
  SkillLineage,
  SkillTransferEdge,
  TeachingReputation,
  SessionRating,
  PassCriteria,
  DifficultyLevel,
} from './types';

// ──────────────────────────────────────────────
// In-Memory Stores (protocol layer)
// ──────────────────────────────────────────────

const curricula = new Map<string, Curriculum>();
const sessions = new Map<string, TeachingSession>();
const demonstrations = new Map<string, Demonstration[]>();
const assessments = new Map<string, Assessment[]>();
const certificates = new Map<string, SkillCertificate[]>();
const lineages = new Map<string, SkillLineage>();
const reputations = new Map<string, TeachingReputation>();
const ratings = new Map<string, SessionRating[]>();

let idCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++idCounter).toString(36)}`;
}

// ──────────────────────────────────────────────
// Curriculum Management
// ──────────────────────────────────────────────

export function createCurriculum(
  authorAgentId: string,
  params: {
    skill_name: string;
    title: string;
    description: string;
    target_capabilities: string[];
    modules: Omit<CurriculumModule, 'id'>[];
  },
): Curriculum {
  const skillId = generateId('skill');
  const modules: CurriculumModule[] = params.modules.map((m, i) => ({
    ...m,
    id: generateId('mod'),
    order: m.order ?? i,
  }));

  validatePrerequisiteChain(modules);

  const totalDuration = modules.reduce((sum, m) => sum + m.estimated_duration_s, 0);
  const now = new Date().toISOString();

  const curriculum: Curriculum = {
    id: generateId('cur'),
    skill_id: skillId,
    skill_name: params.skill_name,
    author_agent_id: authorAgentId,
    title: params.title,
    description: params.description,
    target_capabilities: params.target_capabilities,
    modules: modules.sort((a, b) => a.order - b.order),
    status: 'published' as CurriculumStatus,
    total_duration_s: totalDuration,
    version: 1,
    completion_rate: 0,
    avg_score: 0,
    created_at: now,
    updated_at: now,
  };

  curricula.set(curriculum.id, curriculum);

  // Initialize lineage tracking
  const lineage: SkillLineage = {
    skill_id: skillId,
    skill_name: params.skill_name,
    origin_agent_id: authorAgentId,
    transfers: [],
    total_holders: 1,
    avg_acquisition_score: 0,
    max_depth: 0,
  };
  lineages.set(skillId, lineage);

  return curriculum;
}

export function getCurriculum(id: string): Curriculum | undefined {
  return curricula.get(id);
}

export function listCurricula(params?: {
  skill_name?: string;
  difficulty?: DifficultyLevel;
  min_completion_rate?: number;
  query?: string;
  limit?: number;
  offset?: number;
}): { curricula: Curriculum[]; total: number } {
  let results = Array.from(curricula.values()).filter(
    (c) => c.status === 'published',
  );

  if (params?.skill_name) {
    const needle = params.skill_name.toLowerCase();
    results = results.filter((c) => c.skill_name.toLowerCase().includes(needle));
  }

  if (params?.difficulty) {
    results = results.filter((c) =>
      c.modules.some((m) => m.difficulty === params.difficulty),
    );
  }

  if (params?.min_completion_rate !== undefined) {
    results = results.filter(
      (c) => c.completion_rate >= params.min_completion_rate!,
    );
  }

  if (params?.query) {
    const q = params.query.toLowerCase();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.skill_name.toLowerCase().includes(q),
    );
  }

  const total = results.length;
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  results = results.slice(offset, offset + limit);

  return { curricula: results, total };
}

export function updateCurriculumStatus(
  id: string,
  status: CurriculumStatus,
): Curriculum {
  const cur = curricula.get(id);
  if (!cur) throw new Error(`Curriculum ${id} not found`);
  cur.status = status;
  cur.updated_at = new Date().toISOString();
  return cur;
}

// ──────────────────────────────────────────────
// Prerequisite Validation
// ──────────────────────────────────────────────

export function validatePrerequisiteChain(modules: CurriculumModule[]): void {
  const ids = new Set(modules.map((m) => m.id));

  for (const mod of modules) {
    for (const prereq of mod.prerequisites) {
      if (!ids.has(prereq)) {
        throw new Error(
          `Module "${mod.title}" references unknown prerequisite "${prereq}"`,
        );
      }
    }
  }

  // Check for cycles via topological sort
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const modMap = new Map(modules.map((m) => [m.id, m]));

  function dfs(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular prerequisite detected involving module "${id}"`);
    }
    visiting.add(id);
    const mod = modMap.get(id)!;
    for (const prereq of mod.prerequisites) {
      dfs(prereq);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const mod of modules) {
    dfs(mod.id);
  }
}

// ──────────────────────────────────────────────
// Teaching Sessions
// ──────────────────────────────────────────────

export function requestSession(
  learnerAgentId: string,
  params: {
    curriculum_id: string;
    mentor_agent_id: string;
    metadata?: Record<string, unknown>;
  },
): TeachingSession {
  const cur = curricula.get(params.curriculum_id);
  if (!cur) throw new Error(`Curriculum ${params.curriculum_id} not found`);

  if (learnerAgentId === params.mentor_agent_id) {
    throw new Error('Agent cannot be both mentor and learner');
  }

  const moduleProgress: ModuleProgress[] = cur.modules.map((m) => ({
    module_id: m.id,
    status: 'pending',
    attempts: 0,
    best_score: 0,
    time_spent_s: 0,
  }));

  const now = new Date().toISOString();
  const session: TeachingSession = {
    id: generateId('ses'),
    curriculum_id: params.curriculum_id,
    mentor_agent_id: params.mentor_agent_id,
    learner_agent_id: learnerAgentId,
    status: 'requested',
    module_progress: moduleProgress,
    overall_score: 0,
    passed: false,
    credits_charged: 0,
    metadata: params.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  sessions.set(session.id, session);
  return session;
}

export function acceptSession(
  sessionId: string,
  mentorAgentId: string,
): TeachingSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.mentor_agent_id !== mentorAgentId) {
    throw new Error('Only the assigned mentor can accept this session');
  }
  if (session.status !== 'requested') {
    throw new Error(`Cannot accept session in status "${session.status}"`);
  }

  session.status = 'accepted';
  session.updated_at = new Date().toISOString();
  return session;
}

export function startSession(
  sessionId: string,
  mentorAgentId: string,
): TeachingSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.mentor_agent_id !== mentorAgentId) {
    throw new Error('Only the mentor can start this session');
  }
  if (session.status !== 'accepted') {
    throw new Error(`Cannot start session in status "${session.status}"`);
  }

  session.status = 'in_progress';
  session.started_at = new Date().toISOString();
  session.updated_at = session.started_at;

  // Auto-start first module
  const firstModule = session.module_progress[0];
  if (firstModule) {
    firstModule.status = 'in_progress';
    firstModule.started_at = session.started_at;
    session.current_module_id = firstModule.module_id;
  }

  return session;
}

export function getSession(id: string): TeachingSession | undefined {
  return sessions.get(id);
}

export function listSessions(
  agentId: string,
  params?: {
    role?: 'mentor' | 'learner';
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  },
): { sessions: TeachingSession[]; total: number } {
  let results = Array.from(sessions.values());

  if (params?.role === 'mentor') {
    results = results.filter((s) => s.mentor_agent_id === agentId);
  } else if (params?.role === 'learner') {
    results = results.filter((s) => s.learner_agent_id === agentId);
  } else {
    results = results.filter(
      (s) => s.mentor_agent_id === agentId || s.learner_agent_id === agentId,
    );
  }

  if (params?.status) {
    results = results.filter((s) => s.status === params.status);
  }

  const total = results.length;
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 50;
  results = results.slice(offset, offset + limit);

  return { sessions: results, total };
}

// ──────────────────────────────────────────────
// Module Progression
// ──────────────────────────────────────────────

export function advanceModule(
  sessionId: string,
  moduleId: string,
  action: 'start' | 'complete' | 'skip',
  params?: { score?: number; feedback?: string },
): { session: TeachingSession; module_progress: ModuleProgress } {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.status !== 'in_progress') {
    throw new Error(`Session is not in progress (status: ${session.status})`);
  }

  const mp = session.module_progress.find((p) => p.module_id === moduleId);
  if (!mp) throw new Error(`Module ${moduleId} not found in session`);

  const now = new Date().toISOString();

  switch (action) {
    case 'start':
      if (mp.status !== 'pending') {
        throw new Error(`Module already ${mp.status}`);
      }
      // Check prerequisites
      checkModulePrerequisites(session, moduleId);
      mp.status = 'in_progress';
      mp.started_at = now;
      mp.attempts += 1;
      session.current_module_id = moduleId;
      break;

    case 'complete': {
      if (mp.status !== 'in_progress') {
        throw new Error(`Module not in progress (status: ${mp.status})`);
      }
      const score = params?.score ?? 0;
      mp.best_score = Math.max(mp.best_score, score);
      mp.feedback = params?.feedback;
      mp.completed_at = now;

      // Check against pass criteria
      const cur = curricula.get(session.curriculum_id)!;
      const mod = cur.modules.find((m) => m.id === moduleId)!;
      mp.status = score >= mod.pass_criteria.min_accuracy ? 'passed' : 'failed';

      if (mp.started_at) {
        mp.time_spent_s += Math.floor(
          (new Date(now).getTime() - new Date(mp.started_at).getTime()) / 1000,
        );
      }
      break;
    }

    case 'skip':
      mp.status = 'skipped';
      mp.completed_at = now;
      break;
  }

  // Update overall score
  const scored = session.module_progress.filter(
    (p) => p.status === 'passed' || p.status === 'failed',
  );
  if (scored.length > 0) {
    session.overall_score =
      scored.reduce((sum, p) => sum + p.best_score, 0) / scored.length;
  }

  session.updated_at = now;
  return { session, module_progress: mp };
}

function checkModulePrerequisites(
  session: TeachingSession,
  moduleId: string,
): void {
  const cur = curricula.get(session.curriculum_id);
  if (!cur) return;
  const mod = cur.modules.find((m) => m.id === moduleId);
  if (!mod) return;

  for (const prereqId of mod.prerequisites) {
    const prereqProgress = session.module_progress.find(
      (p) => p.module_id === prereqId,
    );
    if (!prereqProgress || prereqProgress.status !== 'passed') {
      throw new Error(
        `Prerequisite module "${prereqId}" must be passed before starting "${moduleId}"`,
      );
    }
  }
}

// ──────────────────────────────────────────────
// Demonstrations
// ──────────────────────────────────────────────

export function recordDemonstration(
  sessionId: string,
  params: {
    module_id: string;
    performer: 'mentor' | 'learner';
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    latency_ms: number;
  },
): Demonstration {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.status !== 'in_progress') {
    throw new Error('Session must be in progress to record demonstrations');
  }

  const cur = curricula.get(session.curriculum_id)!;
  const mod = cur.modules.find((m) => m.id === params.module_id);
  if (!mod) throw new Error(`Module ${params.module_id} not found`);

  // Score learner demos against pass criteria
  let accuracyScore: number | null = null;
  let meetsCriteria = true;

  if (params.performer === 'learner') {
    // Simple scoring: compare output fields to mentor demos
    const mentorDemos = (demonstrations.get(sessionId) ?? []).filter(
      (d) => d.module_id === params.module_id && d.performer === 'mentor',
    );

    if (mentorDemos.length > 0) {
      accuracyScore = computeDemoAccuracy(params.output, mentorDemos[0].output);
    } else {
      accuracyScore = 0.5; // No mentor baseline — neutral score
    }

    meetsCriteria =
      accuracyScore >= mod.pass_criteria.min_accuracy &&
      (!mod.pass_criteria.max_latency_ms ||
        params.latency_ms <= mod.pass_criteria.max_latency_ms);
  }

  const demo: Demonstration = {
    id: generateId('demo'),
    session_id: sessionId,
    module_id: params.module_id,
    performer: params.performer,
    input: params.input,
    output: params.output,
    accuracy_score: accuracyScore,
    latency_ms: params.latency_ms,
    meets_criteria: meetsCriteria,
    created_at: new Date().toISOString(),
  };

  const sessionDemos = demonstrations.get(sessionId) ?? [];
  sessionDemos.push(demo);
  demonstrations.set(sessionId, sessionDemos);

  return demo;
}

export function getDemonstrations(sessionId: string): Demonstration[] {
  return demonstrations.get(sessionId) ?? [];
}

/** Compute accuracy by comparing output field overlap. */
export function computeDemoAccuracy(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): number {
  const expectedKeys = Object.keys(expected);
  if (expectedKeys.length === 0) return 1;

  let matches = 0;
  for (const key of expectedKeys) {
    if (
      key in actual &&
      JSON.stringify(actual[key]) === JSON.stringify(expected[key])
    ) {
      matches++;
    }
  }

  return matches / expectedKeys.length;
}

// ──────────────────────────────────────────────
// Assessments & Certification
// ──────────────────────────────────────────────

export function runAssessment(
  sessionId: string,
  params: {
    type: AssessmentType;
    module_id?: string;
    test_cases: Omit<TestCase, 'id'>[];
    results: Omit<TestResult, 'test_case_id'>[];
  },
): { assessment: Assessment; certificate?: SkillCertificate } {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  if (session.status !== 'in_progress' && session.status !== 'assessment') {
    throw new Error('Session must be in progress or in assessment phase');
  }

  // Assign IDs to test cases and map results
  const testCases: TestCase[] = params.test_cases.map((tc) => ({
    ...tc,
    id: generateId('tc'),
  }));

  const testResults: TestResult[] = params.results.map((r, i) => ({
    ...r,
    test_case_id: testCases[i]?.id ?? generateId('tc'),
  }));

  // Compute weighted aggregate score
  const totalWeight = testCases.reduce((sum, tc) => sum + tc.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? testResults.reduce((sum, r, i) => {
          const weight = testCases[i]?.weight ?? 1;
          return sum + r.score * weight;
        }, 0) / totalWeight
      : 0;

  const cur = curricula.get(session.curriculum_id)!;
  let passCriteria: PassCriteria;

  if (params.module_id) {
    const mod = cur.modules.find((m) => m.id === params.module_id);
    passCriteria = mod?.pass_criteria ?? { min_accuracy: 0.7, min_successful_demos: 1 };
  } else {
    // Final certification: use strictest module criteria
    passCriteria = {
      min_accuracy: Math.max(...cur.modules.map((m) => m.pass_criteria.min_accuracy)),
      min_successful_demos: 1,
    };
  }

  const passed = weightedScore >= passCriteria.min_accuracy;

  const assessment: Assessment = {
    id: generateId('asmt'),
    session_id: sessionId,
    type: params.type,
    module_id: params.module_id,
    test_cases: testCases,
    results: testResults,
    aggregate_score: weightedScore,
    passed,
    created_at: new Date().toISOString(),
  };

  const sessionAssessments = assessments.get(sessionId) ?? [];
  sessionAssessments.push(assessment);
  assessments.set(sessionId, sessionAssessments);

  // Issue certificate on final certification pass
  let certificate: SkillCertificate | undefined;
  if (params.type === 'final_certification' && passed) {
    certificate = issueCertificate(session, assessment, cur);
  }

  // Update session status
  if (params.type === 'final_certification') {
    session.status = 'completed';
    session.passed = passed;
    session.overall_score = weightedScore;
    session.completed_at = new Date().toISOString();
    session.updated_at = session.completed_at;

    // Update curriculum stats
    updateCurriculumStats(cur);
  } else {
    session.status = 'assessment';
    session.updated_at = new Date().toISOString();
  }

  return { assessment, certificate };
}

function issueCertificate(
  session: TeachingSession,
  assessment: Assessment,
  curriculum: Curriculum,
): SkillCertificate {
  // Determine highest difficulty level passed
  const passedModules = session.module_progress
    .filter((mp) => mp.status === 'passed')
    .map((mp) => curriculum.modules.find((m) => m.id === mp.module_id))
    .filter(Boolean) as CurriculumModule[];

  const difficultyRank: Record<DifficultyLevel, number> = {
    foundational: 0,
    intermediate: 1,
    advanced: 2,
    expert: 3,
  };

  const maxDifficulty = passedModules.reduce<DifficultyLevel>(
    (max, mod) =>
      difficultyRank[mod.difficulty] > difficultyRank[max]
        ? mod.difficulty
        : max,
    'foundational',
  );

  const cert: SkillCertificate = {
    id: generateId('cert'),
    learner_agent_id: session.learner_agent_id,
    mentor_agent_id: session.mentor_agent_id,
    curriculum_id: session.curriculum_id,
    session_id: session.id,
    skill_id: curriculum.skill_id,
    skill_name: curriculum.skill_name,
    score: assessment.aggregate_score,
    level_achieved: maxDifficulty,
    acquired_capabilities: curriculum.target_capabilities,
    issued_at: new Date().toISOString(),
  };

  const agentCerts = certificates.get(session.learner_agent_id) ?? [];
  agentCerts.push(cert);
  certificates.set(session.learner_agent_id, agentCerts);

  // Update skill lineage
  recordTransfer(curriculum.skill_id, session, assessment.aggregate_score);

  return cert;
}

export function getAssessments(sessionId: string): Assessment[] {
  return assessments.get(sessionId) ?? [];
}

export function getCertificates(
  agentId: string,
): { certificates: SkillCertificate[]; total: number } {
  const certs = certificates.get(agentId) ?? [];
  return { certificates: certs, total: certs.length };
}

// ──────────────────────────────────────────────
// Skill Lineage
// ──────────────────────────────────────────────

function recordTransfer(
  skillId: string,
  session: TeachingSession,
  score: number,
): void {
  const lineage = lineages.get(skillId);
  if (!lineage) return;

  // Compute generation
  const mentorTransfer = lineage.transfers.find(
    (t) => t.learner_agent_id === session.mentor_agent_id,
  );
  const generation = mentorTransfer ? mentorTransfer.generation + 1 : 1;

  const edge: SkillTransferEdge = {
    mentor_agent_id: session.mentor_agent_id,
    learner_agent_id: session.learner_agent_id,
    session_id: session.id,
    score,
    generation,
    transferred_at: new Date().toISOString(),
  };

  lineage.transfers.push(edge);
  lineage.total_holders += 1;
  lineage.max_depth = Math.max(lineage.max_depth, generation);

  // Recalculate average
  const scores = lineage.transfers.map((t) => t.score);
  lineage.avg_acquisition_score =
    scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function getLineage(skillId: string): SkillLineage | undefined {
  return lineages.get(skillId);
}

// ──────────────────────────────────────────────
// Teaching Reputation
// ──────────────────────────────────────────────

export function getTeachingReputation(
  agentId: string,
): TeachingReputation {
  const existing = reputations.get(agentId);
  if (existing) return existing;

  // Compute from sessions
  const mentored = Array.from(sessions.values()).filter(
    (s) => s.mentor_agent_id === agentId && s.status === 'completed',
  );

  const successful = mentored.filter((s) => s.passed);
  const agentRatings = ratings.get(agentId) ?? [];
  const skills = new Set(
    mentored.map((s) => curricula.get(s.curriculum_id)?.skill_name).filter(Boolean),
  );

  const passRate = mentored.length > 0 ? successful.length / mentored.length : 0;
  const avgScore =
    mentored.length > 0
      ? mentored.reduce((sum, s) => sum + s.overall_score, 0) / mentored.length
      : 0;
  const avgRating =
    agentRatings.length > 0
      ? agentRatings.reduce((sum, r) => sum + r.rating, 0) / agentRatings.length
      : 0;

  // Composite score: 40% pass rate, 30% avg score, 30% avg rating
  const reputationScore = Math.round(
    (passRate * 40 + avgScore * 30 + (avgRating / 5) * 30) * 100,
  ) / 100;

  const rep: TeachingReputation = {
    agent_id: agentId,
    sessions_mentored: mentored.length,
    successful_sessions: successful.length,
    pass_rate: passRate,
    avg_learner_score: avgScore,
    skills_taught: skills.size,
    reputation_score: reputationScore,
    ratings_count: agentRatings.length,
    avg_rating: avgRating,
    updated_at: new Date().toISOString(),
  };

  reputations.set(agentId, rep);
  return rep;
}

export function rateSession(
  sessionId: string,
  learnerAgentId: string,
  params: { rating: number; feedback?: string },
): { rating: SessionRating; updated_reputation: TeachingReputation } {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.learner_agent_id !== learnerAgentId) {
    throw new Error('Only the learner can rate a session');
  }
  if (session.status !== 'completed') {
    throw new Error('Can only rate completed sessions');
  }

  const rating: SessionRating = {
    id: generateId('rat'),
    session_id: sessionId,
    learner_agent_id: learnerAgentId,
    mentor_agent_id: session.mentor_agent_id,
    rating: Math.max(1, Math.min(5, params.rating)),
    feedback: params.feedback,
    created_at: new Date().toISOString(),
  };

  const mentorRatings = ratings.get(session.mentor_agent_id) ?? [];
  mentorRatings.push(rating);
  ratings.set(session.mentor_agent_id, mentorRatings);

  // Invalidate cached reputation so it recomputes
  reputations.delete(session.mentor_agent_id);
  const updatedRep = getTeachingReputation(session.mentor_agent_id);

  return { rating, updated_reputation: updatedRep };
}

// ──────────────────────────────────────────────
// Curriculum Stats Update
// ──────────────────────────────────────────────

function updateCurriculumStats(curriculum: Curriculum): void {
  const allSessions = Array.from(sessions.values()).filter(
    (s) => s.curriculum_id === curriculum.id && s.status === 'completed',
  );

  if (allSessions.length === 0) return;

  const passed = allSessions.filter((s) => s.passed);
  curriculum.completion_rate = passed.length / allSessions.length;
  curriculum.avg_score =
    allSessions.reduce((sum, s) => sum + s.overall_score, 0) /
    allSessions.length;
  curriculum.updated_at = new Date().toISOString();
}

// ──────────────────────────────────────────────
// Store Reset (for testing)
// ──────────────────────────────────────────────

export function resetStores(): void {
  curricula.clear();
  sessions.clear();
  demonstrations.clear();
  assessments.clear();
  certificates.clear();
  lineages.clear();
  reputations.clear();
  ratings.clear();
  idCounter = 0;
}
