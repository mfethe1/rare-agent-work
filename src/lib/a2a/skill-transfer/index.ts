/**
 * Agent Skill Transfer & Knowledge Distillation Protocol
 *
 * Live peer-to-peer skill transfer between agents — the missing link
 * between static capability packages and truly adaptive agent ecosystems.
 */

// ── Types ──
export type {
  DifficultyLevel,
  ModuleDelivery,
  CurriculumModule,
  PassCriteria,
  CurriculumStatus,
  Curriculum,
  SessionStatus,
  ModuleProgress,
  TeachingSession,
  Demonstration,
  AssessmentType,
  TestCase,
  TestResult,
  Assessment,
  SkillCertificate,
  SkillLineage,
  SkillTransferEdge,
  TeachingReputation,
  SessionRating,
  CreateCurriculumRequest,
  CreateCurriculumResponse,
  ListCurriculaResponse,
  RequestSessionRequest,
  RequestSessionResponse,
  AcceptSessionResponse,
  AdvanceModuleRequest,
  AdvanceModuleResponse,
  RecordDemoRequest,
  RecordDemoResponse,
  RunAssessmentRequest,
  RunAssessmentResponse,
  GetLineageResponse,
  GetTeachingReputationResponse,
  RateSessionRequest,
  RateSessionResponse,
  SearchCurriculaRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  CertificateListResponse,
} from './types';

// ── Engine ──
export {
  createCurriculum,
  getCurriculum,
  listCurricula,
  updateCurriculumStatus,
  validatePrerequisiteChain,
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
} from './engine';

// ── Validation ──
export {
  createCurriculumSchema,
  searchCurriculaSchema,
  requestSessionSchema,
  listSessionsSchema,
  advanceModuleSchema,
  recordDemoSchema,
  runAssessmentSchema,
  rateSessionSchema,
} from './validation';
export type {
  CreateCurriculumInput,
  SearchCurriculaInput,
  RequestSessionInput,
  ListSessionsInput,
  AdvanceModuleInput,
  RecordDemoInput,
  RunAssessmentInput,
  RateSessionInput,
} from './validation';
