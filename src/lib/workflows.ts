import path from "node:path";
import { JsonFileStore } from "./data-store";

const WORKFLOWS_FILE = path.join(process.cwd(), "data/workflows/workflows.json");
const store = new JsonFileStore<Workflow>(WORKFLOWS_FILE);

export type WorkflowStatus = "draft" | "running" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type StepType = "api_call" | "agent_task" | "conditional" | "parallel" | "wait";

export interface WorkflowStep {
  id: string;
  type: StepType;
  config: Record<string, unknown>;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  created_by: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  input?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface CreateWorkflowInput {
  name: string;
  created_by: string;
  steps: Array<{
    type: StepType;
    config: Record<string, unknown>;
  }>;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function createWorkflow(input: CreateWorkflowInput): Promise<Workflow> {
  const now = new Date().toISOString();

  const steps: WorkflowStep[] = input.steps.map((s) => ({
    id: crypto.randomUUID(),
    type: s.type,
    config: s.config,
    status: "pending",
  }));

  const workflow: Workflow = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    created_by: input.created_by,
    steps,
    status: "draft",
    created_at: now,
  };

  return store.create(workflow);
}

export async function getAgentWorkflows(agentId: string): Promise<Workflow[]> {
  return store.query((w) => w.created_by === agentId);
}

export async function getWorkflowById(id: string): Promise<Workflow | null> {
  return store.getById(id);
}

/**
 * Simulate workflow execution by marking steps as completed sequentially.
 * In production, this would orchestrate actual API calls and agent tasks.
 */
export async function runWorkflow(
  workflowId: string,
  agentId: string,
  input?: Record<string, unknown>,
): Promise<Workflow> {
  return store.transaction(async (workflows) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) throw new Error("Workflow not found");
    if (workflow.created_by !== agentId) throw new Error("Not authorized");
    if (workflow.status === "running") throw new Error("Workflow is already running");

    const now = new Date().toISOString();
    workflow.status = "running";
    workflow.started_at = now;
    if (input) workflow.input = input;

    // Simulate sequential execution
    let allCompleted = true;
    for (const step of workflow.steps) {
      if (step.status === "pending") {
        const stepStart = new Date().toISOString();
        step.status = "running";
        step.started_at = stepStart;
        step.input = input ?? {};

        // Simulate step execution
        try {
          step.output = simulateStepOutput(step, input);
          step.status = "completed";
          step.completed_at = new Date().toISOString();
        } catch (err) {
          step.status = "failed";
          step.error = err instanceof Error ? err.message : "Step execution failed";
          step.completed_at = new Date().toISOString();
          allCompleted = false;
          break;
        }
      }
    }

    workflow.status = allCompleted ? "completed" : "failed";
    workflow.completed_at = new Date().toISOString();

    return { items: workflows, result: workflow };
  });
}

function simulateStepOutput(step: WorkflowStep, input?: Record<string, unknown>): unknown {
  switch (step.type) {
    case "api_call":
      return {
        status: "success",
        response: { message: `API call to ${step.config.url ?? "endpoint"} simulated` },
      };
    case "agent_task":
      return {
        task_id: crypto.randomUUID(),
        assigned: true,
        message: `Task "${step.config.title ?? "untitled"}" created and assigned`,
      };
    case "conditional":
      return {
        condition_met: true,
        branch: "true",
        evaluation: `Condition "${step.config.condition ?? "default"}" evaluated`,
      };
    case "parallel":
      return {
        parallel_tasks: step.config.tasks ?? [],
        all_completed: true,
      };
    case "wait":
      return {
        waited_ms: step.config.duration_ms ?? 1000,
        completed: true,
      };
    default:
      return { completed: true };
  }
}
