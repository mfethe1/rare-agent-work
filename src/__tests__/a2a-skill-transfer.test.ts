/**
 * Tests for Agent Skill Transfer & Knowledge Distillation Protocol
 */

import {
  createCurriculum,
  getCurriculum,
  listCurricula,
  requestSession,
  acceptSession,
  startSession,
  getSession,
  listSessions,
  advanceModule,
  recordDemonstration,
  getDemonstrations,
  computeDemoAccuracy,
  runAssessment,
  getAssessments,
  getCertificates,
  getLineage,
  getTeachingReputation,
  rateSession,
  resetStores,
  validatePrerequisiteChain,
} from '@/lib/a2a/skill-transfer';

const MENTOR = 'agent_mentor_001';
const LEARNER = 'agent_learner_001';

function makeCurriculumParams() {
  return {
    skill_name: 'web-scraping',
    title: 'Web Scraping Mastery',
    description: 'Learn to scrape structured data from websites',
    target_capabilities: ['data-retrieval.web-scrape', 'data-transformation.html-parse'],
    modules: [
      {
        title: 'HTTP Basics',
        description: 'Understanding HTTP requests and responses',
        difficulty: 'foundational',
        delivery: 'demonstration',
        prerequisites: [],
        estimated_duration_s: 600,
        pass_criteria: { min_accuracy: 0.7, min_successful_demos: 1 },
        order: 0,
      },
      {
        title: 'HTML Parsing',
        description: 'Parsing HTML documents with selectors',
        difficulty: 'intermediate',
        delivery: 'guided_practice',
        prerequisites: [], // Will be set after creation to reference first module
        estimated_duration_s: 900,
        pass_criteria: { min_accuracy: 0.8, min_successful_demos: 2 },
        order: 1,
      },
      {
        title: 'Anti-Detection',
        description: 'Handling rate limits and bot detection',
        difficulty: 'advanced',
        delivery: 'independent',
        prerequisites: [],
        estimated_duration_s: 1200,
        pass_criteria: { min_accuracy: 0.85, max_latency_ms: 5000, min_successful_demos: 3 },
        order: 2,
      },
    ],
  };
}

beforeEach(() => {
  resetStores();
});

// ── Curriculum ──

describe('Curriculum Management', () => {
  it('creates a curriculum with modules', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    expect(cur.id).toMatch(/^cur_/);
    expect(cur.skill_name).toBe('web-scraping');
    expect(cur.modules).toHaveLength(3);
    expect(cur.modules[0].id).toMatch(/^mod_/);
    expect(cur.total_duration_s).toBe(600 + 900 + 1200);
    expect(cur.status).toBe('published');
    expect(cur.version).toBe(1);
  });

  it('retrieves a curriculum by ID', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const retrieved = getCurriculum(cur.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(cur.id);
  });

  it('lists curricula with search', () => {
    createCurriculum(MENTOR, makeCurriculumParams());
    createCurriculum(MENTOR, {
      ...makeCurriculumParams(),
      skill_name: 'api-integration',
      title: 'API Integration',
    });

    const all = listCurricula();
    expect(all.total).toBe(2);

    const filtered = listCurricula({ skill_name: 'web' });
    expect(filtered.total).toBe(1);
    expect(filtered.curricula[0].skill_name).toBe('web-scraping');
  });

  it('lists curricula with query search', () => {
    createCurriculum(MENTOR, makeCurriculumParams());
    const result = listCurricula({ query: 'mastery' });
    expect(result.total).toBe(1);
  });

  it('detects circular prerequisites', () => {
    const modules = [
      {
        id: 'a',
        title: 'A',
        description: 'A',
        difficulty: 'foundational',
        delivery: 'demonstration',
        prerequisites: ['b'],
        estimated_duration_s: 100,
        pass_criteria: { min_accuracy: 0.5, min_successful_demos: 1 },
        order: 0,
      },
      {
        id: 'b',
        title: 'B',
        description: 'B',
        difficulty: 'foundational',
        delivery: 'demonstration',
        prerequisites: ['a'],
        estimated_duration_s: 100,
        pass_criteria: { min_accuracy: 0.5, min_successful_demos: 1 },
        order: 1,
      },
    ];

    expect(() => validatePrerequisiteChain(modules)).toThrow(/Circular/);
  });
});

// ── Teaching Sessions ──

describe('Teaching Sessions', () => {
  let curriculumId: string;

  beforeEach(() => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    curriculumId = cur.id;
  });

  it('creates a session request', () => {
    const session = requestSession(LEARNER, {
      curriculum_id: curriculumId,
      mentor_agent_id: MENTOR,
    });
    expect(session.id).toMatch(/^ses_/);
    expect(session.status).toBe('requested');
    expect(session.module_progress).toHaveLength(3);
    expect(session.module_progress[0].status).toBe('pending');
  });

  it('prevents self-teaching', () => {
    expect(() =>
      requestSession(MENTOR, {
        curriculum_id: curriculumId,
        mentor_agent_id: MENTOR,
      }),
    ).toThrow(/both mentor and learner/);
  });

  it('mentor accepts and starts session', () => {
    const session = requestSession(LEARNER, {
      curriculum_id: curriculumId,
      mentor_agent_id: MENTOR,
    });

    const accepted = acceptSession(session.id, MENTOR);
    expect(accepted.status).toBe('accepted');

    const started = startSession(session.id, MENTOR);
    expect(started.status).toBe('in_progress');
    expect(started.started_at).toBeDefined();
    expect(started.module_progress[0].status).toBe('in_progress');
  });

  it('only assigned mentor can accept', () => {
    const session = requestSession(LEARNER, {
      curriculum_id: curriculumId,
      mentor_agent_id: MENTOR,
    });
    expect(() => acceptSession(session.id, 'other_agent')).toThrow(/Only the assigned mentor/);
  });

  it('lists sessions by role', () => {
    requestSession(LEARNER, {
      curriculum_id: curriculumId,
      mentor_agent_id: MENTOR,
    });

    const mentorSessions = listSessions(MENTOR, { role: 'mentor' });
    expect(mentorSessions.total).toBe(1);

    const learnerSessions = listSessions(LEARNER, { role: 'learner' });
    expect(learnerSessions.total).toBe(1);

    const otherSessions = listSessions('other_agent');
    expect(otherSessions.total).toBe(0);
  });
});

// ── Module Progression ──

describe('Module Progression', () => {
  let sessionId: string;
  let moduleIds: string[];

  beforeEach(() => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);
    sessionId = session.id;
    moduleIds = cur.modules.map((m) => m.id);
  });

  it('completes a module with passing score', () => {
    // First module is already in_progress from startSession
    const result = advanceModule(sessionId, moduleIds[0], 'complete', {
      score: 0.9,
      feedback: 'Great work!',
    });
    expect(result.module_progress.status).toBe('passed');
    expect(result.module_progress.best_score).toBe(0.9);
    expect(result.module_progress.feedback).toBe('Great work!');
  });

  it('fails a module with low score', () => {
    const result = advanceModule(sessionId, moduleIds[0], 'complete', {
      score: 0.3,
    });
    expect(result.module_progress.status).toBe('failed');
  });

  it('can skip a module', () => {
    const result = advanceModule(sessionId, moduleIds[0], 'skip');
    expect(result.module_progress.status).toBe('skipped');
  });

  it('tracks overall session score', () => {
    advanceModule(sessionId, moduleIds[0], 'complete', { score: 0.9 });
    advanceModule(sessionId, moduleIds[1], 'start');
    advanceModule(sessionId, moduleIds[1], 'complete', { score: 0.8 });

    const session = getSession(sessionId)!;
    expect(session.overall_score).toBeCloseTo(0.85);
  });
});

// ── Demonstrations ──

describe('Demonstrations', () => {
  let sessionId: string;
  let moduleId: string;

  beforeEach(() => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);
    sessionId = session.id;
    moduleId = cur.modules[0].id;
  });

  it('records mentor demonstration', () => {
    const demo = recordDemonstration(sessionId, {
      module_id: moduleId,
      performer: 'mentor',
      input: { url: 'https://example.com' },
      output: { status: 200, title: 'Example' },
      latency_ms: 150,
    });

    expect(demo.id).toMatch(/^demo_/);
    expect(demo.performer).toBe('mentor');
    expect(demo.accuracy_score).toBeNull(); // Mentor sets the standard
    expect(demo.meets_criteria).toBe(true);
  });

  it('scores learner demonstration against mentor baseline', () => {
    // Mentor demo first
    recordDemonstration(sessionId, {
      module_id: moduleId,
      performer: 'mentor',
      input: { url: 'https://example.com' },
      output: { status: 200, title: 'Example' },
      latency_ms: 100,
    });

    // Learner matches perfectly
    const learnerDemo = recordDemonstration(sessionId, {
      module_id: moduleId,
      performer: 'learner',
      input: { url: 'https://example.com' },
      output: { status: 200, title: 'Example' },
      latency_ms: 120,
    });

    expect(learnerDemo.accuracy_score).toBe(1);
    expect(learnerDemo.meets_criteria).toBe(true);
  });

  it('lists demonstrations for a session', () => {
    recordDemonstration(sessionId, {
      module_id: moduleId,
      performer: 'mentor',
      input: { url: 'test' },
      output: { data: 'ok' },
      latency_ms: 50,
    });

    const demos = getDemonstrations(sessionId);
    expect(demos).toHaveLength(1);
  });

  it('computes demo accuracy correctly', () => {
    expect(computeDemoAccuracy({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(1);
    expect(computeDemoAccuracy({ a: 1, b: 3 }, { a: 1, b: 2 })).toBe(0.5);
    expect(computeDemoAccuracy({ a: 99 }, { a: 1, b: 2 })).toBe(0);
    expect(computeDemoAccuracy({}, {})).toBe(1); // Empty expected = perfect
  });
});

// ── Assessments & Certification ──

describe('Assessments & Certification', () => {
  let sessionId: string;
  let moduleIds: string[];
  let skillId: string;

  beforeEach(() => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    skillId = cur.skill_id;
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);
    sessionId = session.id;
    moduleIds = cur.modules.map((m) => m.id);

    // Complete all modules
    advanceModule(sessionId, moduleIds[0], 'complete', { score: 0.9 });
    advanceModule(sessionId, moduleIds[1], 'start');
    advanceModule(sessionId, moduleIds[1], 'complete', { score: 0.85 });
    advanceModule(sessionId, moduleIds[2], 'start');
    advanceModule(sessionId, moduleIds[2], 'complete', { score: 0.9 });
  });

  it('runs a module quiz assessment', () => {
    const { assessment } = runAssessment(sessionId, {
      type: 'module_quiz',
      module_id: moduleIds[0],
      test_cases: [
        { description: 'Basic GET', input: { method: 'GET' }, weight: 1 },
        { description: 'POST with body', input: { method: 'POST' }, weight: 2 },
      ],
      results: [
        { actual_output: { status: 200 }, score: 1, passed: true },
        { actual_output: { status: 201 }, score: 0.8, passed: true },
      ],
    });

    expect(assessment.id).toMatch(/^asmt_/);
    expect(assessment.type).toBe('module_quiz');
    // Weighted: (1*1 + 0.8*2) / (1+2) = 2.6/3 ≈ 0.867
    expect(assessment.aggregate_score).toBeCloseTo(0.867, 2);
    expect(assessment.passed).toBe(true);
  });

  it('issues certificate on final certification pass', () => {
    const { assessment, certificate } = runAssessment(sessionId, {
      type: 'final_certification',
      test_cases: [
        { description: 'Full scrape', input: { url: 'test' }, weight: 1 },
      ],
      results: [
        { actual_output: { data: 'ok' }, score: 0.95, passed: true },
      ],
    });

    expect(assessment.passed).toBe(true);
    expect(certificate).toBeDefined();
    expect(certificate!.id).toMatch(/^cert_/);
    expect(certificate!.learner_agent_id).toBe(LEARNER);
    expect(certificate!.skill_name).toBe('web-scraping');
    expect(certificate!.acquired_capabilities).toContain('data-retrieval.web-scrape');
    expect(certificate!.level_achieved).toBe('advanced');

    // Session should be completed
    const session = getSession(sessionId)!;
    expect(session.status).toBe('completed');
    expect(session.passed).toBe(true);
  });

  it('does not issue certificate on fail', () => {
    const { assessment, certificate } = runAssessment(sessionId, {
      type: 'final_certification',
      test_cases: [
        { description: 'Full scrape', input: { url: 'test' }, weight: 1 },
      ],
      results: [
        { actual_output: { data: 'bad' }, score: 0.2, passed: false },
      ],
    });

    expect(assessment.passed).toBe(false);
    expect(certificate).toBeUndefined();
  });

  it('retrieves certificates for an agent', () => {
    runAssessment(sessionId, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.95, passed: true }],
    });

    const { certificates, total } = getCertificates(LEARNER);
    expect(total).toBe(1);
    expect(certificates[0].learner_agent_id).toBe(LEARNER);
  });

  it('lists assessments for a session', () => {
    runAssessment(sessionId, {
      type: 'module_quiz',
      module_id: moduleIds[0],
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.9, passed: true }],
    });

    const assmts = getAssessments(sessionId);
    expect(assmts).toHaveLength(1);
  });
});

// ── Skill Lineage ──

describe('Skill Lineage', () => {
  it('tracks skill propagation through generations', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const skillId = cur.skill_id;

    // Gen 1: mentor → learner1
    const s1 = requestSession('learner1', {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(s1.id, MENTOR);
    startSession(s1.id, MENTOR);

    const mods = cur.modules.map((m) => m.id);
    advanceModule(s1.id, mods[0], 'complete', { score: 0.9 });
    advanceModule(s1.id, mods[1], 'start');
    advanceModule(s1.id, mods[1], 'complete', { score: 0.9 });
    advanceModule(s1.id, mods[2], 'start');
    advanceModule(s1.id, mods[2], 'complete', { score: 0.9 });

    runAssessment(s1.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.9, passed: true }],
    });

    // Gen 2: learner1 teaches learner2
    const s2 = requestSession('learner2', {
      curriculum_id: cur.id,
      mentor_agent_id: 'learner1',
    });
    acceptSession(s2.id, 'learner1');
    startSession(s2.id, 'learner1');

    advanceModule(s2.id, mods[0], 'complete', { score: 0.85 });
    advanceModule(s2.id, mods[1], 'start');
    advanceModule(s2.id, mods[1], 'complete', { score: 0.85 });
    advanceModule(s2.id, mods[2], 'start');
    advanceModule(s2.id, mods[2], 'complete', { score: 0.85 });

    runAssessment(s2.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.85, passed: true }],
    });

    const lineage = getLineage(skillId)!;
    expect(lineage.total_holders).toBe(3); // origin + 2 learners
    expect(lineage.transfers).toHaveLength(2);
    expect(lineage.max_depth).toBe(2);

    // Gen 1 transfer
    expect(lineage.transfers[0].generation).toBe(1);
    expect(lineage.transfers[0].learner_agent_id).toBe('learner1');

    // Gen 2 transfer
    expect(lineage.transfers[1].generation).toBe(2);
    expect(lineage.transfers[1].learner_agent_id).toBe('learner2');
  });
});

// ── Teaching Reputation & Rating ──

describe('Teaching Reputation & Rating', () => {
  it('computes teaching reputation from completed sessions', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);

    const mods = cur.modules.map((m) => m.id);
    advanceModule(session.id, mods[0], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[1], 'start');
    advanceModule(session.id, mods[1], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[2], 'start');
    advanceModule(session.id, mods[2], 'complete', { score: 0.9 });

    runAssessment(session.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.95, passed: true }],
    });

    const rep = getTeachingReputation(MENTOR);
    expect(rep.sessions_mentored).toBe(1);
    expect(rep.successful_sessions).toBe(1);
    expect(rep.pass_rate).toBe(1);
    expect(rep.skills_taught).toBe(1);
    expect(rep.reputation_score).toBeGreaterThan(0);
  });

  it('allows learner to rate a completed session', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);

    const mods = cur.modules.map((m) => m.id);
    advanceModule(session.id, mods[0], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[1], 'start');
    advanceModule(session.id, mods[1], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[2], 'start');
    advanceModule(session.id, mods[2], 'complete', { score: 0.9 });

    runAssessment(session.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.95, passed: true }],
    });

    const { rating, updated_reputation } = rateSession(session.id, LEARNER, {
      rating: 5,
      feedback: 'Excellent mentor!',
    });

    expect(rating.rating).toBe(5);
    expect(rating.feedback).toBe('Excellent mentor!');
    expect(updated_reputation.ratings_count).toBe(1);
    expect(updated_reputation.avg_rating).toBe(5);
  });

  it('prevents non-learner from rating', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);

    const mods = cur.modules.map((m) => m.id);
    advanceModule(session.id, mods[0], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[1], 'start');
    advanceModule(session.id, mods[1], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[2], 'start');
    advanceModule(session.id, mods[2], 'complete', { score: 0.9 });

    runAssessment(session.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.95, passed: true }],
    });

    expect(() => rateSession(session.id, 'random_agent', { rating: 5 })).toThrow(
      /Only the learner/,
    );
  });

  it('clamps rating to 1-5', () => {
    const cur = createCurriculum(MENTOR, makeCurriculumParams());
    const session = requestSession(LEARNER, {
      curriculum_id: cur.id,
      mentor_agent_id: MENTOR,
    });
    acceptSession(session.id, MENTOR);
    startSession(session.id, MENTOR);

    const mods = cur.modules.map((m) => m.id);
    advanceModule(session.id, mods[0], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[1], 'start');
    advanceModule(session.id, mods[1], 'complete', { score: 0.9 });
    advanceModule(session.id, mods[2], 'start');
    advanceModule(session.id, mods[2], 'complete', { score: 0.9 });

    runAssessment(session.id, {
      type: 'final_certification',
      test_cases: [{ description: 'test', input: {}, weight: 1 }],
      results: [{ actual_output: {}, score: 0.95, passed: true }],
    });

    const { rating } = rateSession(session.id, LEARNER, { rating: 10 });
    expect(rating.rating).toBe(5);
  });
});
