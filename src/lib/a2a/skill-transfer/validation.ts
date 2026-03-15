/**
 * Agent Skill Transfer & Knowledge Distillation — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Enums ──

const DifficultyLevelEnum = z.enum([
  'foundational', 'intermediate', 'advanced', 'expert',
]);

const ModuleDeliveryEnum = z.enum([
  'demonstration', 'guided_practice', 'independent', 'assessment',
]);

const SessionStatusEnum = z.enum([
  'requested', 'accepted', 'in_progress', 'assessment', 'completed', 'abandoned', 'rejected',
]);

const PerformerEnum = z.enum(['mentor', 'learner']);

const AssessmentTypeEnum = z.enum([
  'module_quiz', 'practical_exam', 'final_certification',
]);

const ModuleActionEnum = z.enum(['start', 'complete', 'skip']);

// ── Sub-schemas ──

const passCriteriaSchema = z.object({
  min_accuracy: z.number().min(0).max(1),
  max_latency_ms: z.number().int().positive().optional(),
  min_successful_demos: z.number().int().min(0),
  custom_evaluator: z.string().max(128).optional(),
});

const moduleSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(2048),
  difficulty: DifficultyLevelEnum,
  delivery: ModuleDeliveryEnum,
  prerequisites: z.array(z.string()).default([]),
  estimated_duration_s: z.number().int().positive(),
  demonstration_inputs: z.array(z.record(z.unknown())).optional(),
  pass_criteria: passCriteriaSchema,
  order: z.number().int().min(0),
});

const testCaseSchema = z.object({
  description: z.string().min(1).max(512),
  input: z.record(z.unknown()),
  expected_output: z.record(z.unknown()).optional(),
  weight: z.number().min(0).default(1),
});

const testResultSchema = z.object({
  actual_output: z.record(z.unknown()),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  feedback: z.string().max(2048).optional(),
});

// ── Curriculum Schemas ──

export const createCurriculumSchema = z.object({
  skill_name: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(4096),
  target_capabilities: z.array(z.string().min(1).max(128)).min(1).max(20),
  modules: z.array(moduleSchema).min(1).max(50),
});
export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;

export const searchCurriculaSchema = z.object({
  query: z.string().max(256).optional(),
  skill_name: z.string().max(128).optional(),
  difficulty: DifficultyLevelEnum.optional(),
  min_completion_rate: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type SearchCurriculaInput = z.infer<typeof searchCurriculaSchema>;

// ── Session Schemas ──

export const requestSessionSchema = z.object({
  curriculum_id: z.string().min(1),
  mentor_agent_id: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type RequestSessionInput = z.infer<typeof requestSessionSchema>;

export const listSessionsSchema = z.object({
  role: z.enum(['mentor', 'learner']).optional(),
  status: SessionStatusEnum.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;

// ── Module Advancement ──

export const advanceModuleSchema = z.object({
  action: ModuleActionEnum,
  score: z.number().min(0).max(1).optional(),
  feedback: z.string().max(2048).optional(),
});
export type AdvanceModuleInput = z.infer<typeof advanceModuleSchema>;

// ── Demonstration ──

export const recordDemoSchema = z.object({
  module_id: z.string().min(1),
  performer: PerformerEnum,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  latency_ms: z.number().int().min(0),
});
export type RecordDemoInput = z.infer<typeof recordDemoSchema>;

// ── Assessment ──

export const runAssessmentSchema = z.object({
  type: AssessmentTypeEnum,
  module_id: z.string().min(1).optional(),
  test_cases: z.array(testCaseSchema).min(1).max(100),
  results: z.array(testResultSchema).min(1).max(100),
});
export type RunAssessmentInput = z.infer<typeof runAssessmentSchema>;

// ── Rating ──

export const rateSessionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2048).optional(),
});
export type RateSessionInput = z.infer<typeof rateSessionSchema>;
