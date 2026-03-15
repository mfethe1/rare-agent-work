import fs from "node:fs";
import path from "node:path";

const TASKS_FILE = path.join(process.cwd(), "data/tasks/tasks.json");

export type TaskStatus =
  | "open"
  | "bidding"
  | "in_progress"
  | "delivered"
  | "reviewing"
  | "completed"
  | "disputed"
  | "cancelled";

export interface TaskRequirements {
  skills: string[];
  min_reputation?: number;
  deadline?: string;
}

export interface TaskBudget {
  credits: number;
  type: "fixed" | "hourly";
}

export interface TaskDeliverable {
  type: string;
  format: string;
}

export interface Bid {
  id: string;
  bidder_agent_id: string;
  amount: number;
  estimated_delivery: string;
  message: string;
  created_at: string;
  status: "pending" | "accepted" | "rejected";
}

export interface Delivery {
  content: string;
  notes: string;
  submitted_at: string;
  submitted_by: string;
}

export interface Review {
  rating: number;
  feedback: string;
  accepted: boolean;
  reviewed_at: string;
  reviewed_by: string;
}

export interface Task {
  id: string;
  owner_agent_id: string;
  title: string;
  description: string;
  requirements: TaskRequirements;
  budget: TaskBudget;
  deliverables: TaskDeliverable[];
  status: TaskStatus;
  bids: Bid[];
  accepted_bid_id?: string;
  assigned_agent_id?: string;
  delivery?: Delivery;
  review?: Review;
  escrow_held: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  owner_agent_id: string;
  title: string;
  description: string;
  requirements: TaskRequirements;
  budget: TaskBudget;
  deliverables: TaskDeliverable[];
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function readTasks(): Task[] {
  try {
    const raw = fs.readFileSync(TASKS_FILE, "utf-8");
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function createTask(input: CreateTaskInput): Task {
  const tasks = readTasks();
  const now = new Date().toISOString();

  const task: Task = {
    id: crypto.randomUUID(),
    owner_agent_id: input.owner_agent_id,
    title: input.title.trim(),
    description: input.description.trim(),
    requirements: input.requirements,
    budget: input.budget,
    deliverables: input.deliverables,
    status: "open",
    bids: [],
    escrow_held: false,
    created_at: now,
    updated_at: now,
  };

  tasks.push(task);
  writeTasks(tasks);
  return task;
}

export interface GetTasksFilter {
  status?: TaskStatus;
  skill?: string;
  min_budget?: number;
  max_budget?: number;
  sort?: "newest" | "oldest" | "budget_high" | "budget_low";
  limit?: number;
  offset?: number;
}

export function getTasks(filter: GetTasksFilter = {}): { tasks: Task[]; total: number } {
  let tasks = readTasks();

  if (filter.status) {
    tasks = tasks.filter((t) => t.status === filter.status);
  }
  if (filter.skill) {
    const skillLower = filter.skill.toLowerCase();
    tasks = tasks.filter((t) =>
      t.requirements.skills.some((s) => s.toLowerCase().includes(skillLower)),
    );
  }
  if (filter.min_budget !== undefined) {
    tasks = tasks.filter((t) => t.budget.credits >= filter.min_budget!);
  }
  if (filter.max_budget !== undefined) {
    tasks = tasks.filter((t) => t.budget.credits <= filter.max_budget!);
  }

  const sort = filter.sort ?? "newest";
  if (sort === "newest") {
    tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sort === "oldest") {
    tasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (sort === "budget_high") {
    tasks.sort((a, b) => b.budget.credits - a.budget.credits);
  } else if (sort === "budget_low") {
    tasks.sort((a, b) => a.budget.credits - b.budget.credits);
  }

  const total = tasks.length;
  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = filter.offset ?? 0;

  return { tasks: tasks.slice(offset, offset + limit), total };
}

export function getTaskById(id: string): Task | null {
  const tasks = readTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

export function addBid(
  taskId: string,
  bidderAgentId: string,
  input: { amount: number; estimated_delivery: string; message: string },
): { task: Task; bid: Bid } {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  if (!["open", "bidding"].includes(task.status)) {
    throw new Error(`Cannot bid on a task with status: ${task.status}`);
  }
  if (task.owner_agent_id === bidderAgentId) {
    throw new Error("Cannot bid on your own task");
  }
  if (task.bids.some((b) => b.bidder_agent_id === bidderAgentId)) {
    throw new Error("You have already placed a bid on this task");
  }

  const bid: Bid = {
    id: crypto.randomUUID(),
    bidder_agent_id: bidderAgentId,
    amount: input.amount,
    estimated_delivery: input.estimated_delivery,
    message: input.message,
    created_at: new Date().toISOString(),
    status: "pending",
  };

  task.bids.push(bid);
  task.status = "bidding";
  task.updated_at = new Date().toISOString();

  writeTasks(tasks);
  return { task, bid };
}

export function acceptBid(
  taskId: string,
  ownerAgentId: string,
  bidId: string,
): Task {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  if (task.owner_agent_id !== ownerAgentId) throw new Error("Not authorized");
  if (task.status !== "bidding") throw new Error(`Cannot accept bid on task with status: ${task.status}`);

  const bid = task.bids.find((b) => b.id === bidId);
  if (!bid) throw new Error("Bid not found");

  bid.status = "accepted";
  task.bids
    .filter((b) => b.id !== bidId)
    .forEach((b) => (b.status = "rejected"));

  task.accepted_bid_id = bidId;
  task.assigned_agent_id = bid.bidder_agent_id;
  task.status = "in_progress";
  task.updated_at = new Date().toISOString();

  writeTasks(tasks);
  return task;
}

export function submitDelivery(
  taskId: string,
  agentId: string,
  input: { content: string; notes: string },
): Task {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  if (task.assigned_agent_id !== agentId) throw new Error("Not authorized — you are not assigned to this task");
  if (task.status !== "in_progress") throw new Error(`Cannot deliver on task with status: ${task.status}`);

  task.delivery = {
    content: input.content,
    notes: input.notes,
    submitted_at: new Date().toISOString(),
    submitted_by: agentId,
  };
  task.status = "delivered";
  task.updated_at = new Date().toISOString();

  writeTasks(tasks);
  return task;
}

export function reviewDelivery(
  taskId: string,
  ownerAgentId: string,
  input: { rating: number; feedback: string; accept: boolean },
): Task {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  if (task.owner_agent_id !== ownerAgentId) throw new Error("Not authorized");
  if (!["delivered", "reviewing"].includes(task.status)) {
    throw new Error(`Cannot review task with status: ${task.status}`);
  }

  task.review = {
    rating: input.rating,
    feedback: input.feedback,
    accepted: input.accept,
    reviewed_at: new Date().toISOString(),
    reviewed_by: ownerAgentId,
  };
  task.status = input.accept ? "completed" : "reviewing";
  task.updated_at = new Date().toISOString();

  writeTasks(tasks);
  return task;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): Task {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  task.status = status;
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  return task;
}
