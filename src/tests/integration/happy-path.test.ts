/**
 * Integration Test: Happy Path Lifecycle
 * Tests: register → verify → deposit → create task → bid → accept → deliver → review → reputation → wallet
 * Round 26
 */

import { describe, it, expect, beforeAll } from "vitest";
import { registerAgent, verifyApiKey, getAgentById, getAllAgents } from "@/lib/agent-auth";
import { addCredits, getBalance, getTransactions } from "@/lib/wallet";
import { createTask, getTasks, getTaskById, addBid, acceptBid, submitDelivery, reviewDelivery } from "@/lib/tasks";
import { getReputation, recordTaskCompleted } from "@/lib/reputation";
import { sendMessage, listInbox, getMessageById, markMessageRead, getThread } from "@/lib/messages";
import { createNotification, getNotifications } from "@/lib/notifications";
import { checkRateLimit, getRateLimitStatus } from "@/lib/rate-limiter";

let agentApiKey: string;
let agentId: string;
let agent2ApiKey: string;
let agent2Id: string;
let taskId: string;
let bidId: string;

describe("Happy Path Lifecycle", () => {
  beforeAll(async () => {
    const result1 = await registerAgent({
      name: `TestAgent-${Date.now()}`,
      description: "Integration test agent",
      capabilities: ["research", "coding"],
    });
    agentApiKey = result1.api_key;
    agentId = result1.agent.agent_id;

    const result2 = await registerAgent({
      name: `TestAgent2-${Date.now()}`,
      description: "Second integration test agent",
      capabilities: ["research", "task"],
    });
    agent2ApiKey = result2.api_key;
    agent2Id = result2.agent.agent_id;
  });

  it("1. should register an agent and return API key", () => {
    expect(agentApiKey).toBeDefined();
    expect(agentApiKey.startsWith("ra_")).toBe(true);
    expect(agentId).toBeDefined();
  });

  it("2. should verify a valid API key", async () => {
    const agent = await verifyApiKey(agentApiKey);
    expect(agent).not.toBeNull();
    expect(agent?.agent_id).toBe(agentId);
  });

  it("3. should reject an invalid API key", async () => {
    const agent = await verifyApiKey("ra_invalid_key_here");
    expect(agent).toBeNull();
  });

  it("4. should get agent by ID", async () => {
    const agent = await getAgentById(agentId);
    expect(agent).not.toBeNull();
    expect(agent?.name).toContain("TestAgent");
  });

  it("5. should list all agents including test agents", async () => {
    const agents = await getAllAgents();
    expect(agents.length).toBeGreaterThanOrEqual(2);
    expect(agents.some((a) => a.agent_id === agentId)).toBe(true);
  });

  it("6. should deposit credits", async () => {
    const tx = await addCredits(agentId, 500, "test deposit");
    expect(tx.amount).toBe(500);
    expect(tx.type).toBe("credit");
  });

  it("7. should check wallet balance after deposit", async () => {
    const balance = await getBalance(agentId);
    expect(balance.balance).toBeGreaterThanOrEqual(500);
  });

  it("8. should create a task", async () => {
    const task = await createTask({
      title: `Test Task ${Date.now()}`,
      description: "Test task for integration test",
      owner_agent_id: agentId,
      requirements: { skills: ["research"], min_reputation: 0 },
      budget: { credits: 50, type: "fixed" },
      deliverables: [{ type: "document", format: "markdown" }],
    });
    taskId = task.id;
    expect(task.id).toBeDefined();
    expect(task.status).toBe("open");
  });

  it("9. should list tasks", async () => {
    const result = await getTasks({});
    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks.some((t) => t.id === taskId)).toBe(true);
  });

  it("10. should get task by ID", async () => {
    const task = await getTaskById(taskId);
    expect(task).not.toBeNull();
    expect(task?.id).toBe(taskId);
  });

  it("11. should add a bid to a task", async () => {
    const result = await addBid(taskId, agent2Id, {
      amount: 40,
      estimated_delivery: "2026-04-01",
      message: "I can complete this research task",
    });
    expect(result.task.bids.length).toBeGreaterThanOrEqual(1);
    expect(result.bid.bidder_agent_id).toBe(agent2Id);
    bidId = result.bid.id;
  });

  it("12. should accept a bid", async () => {
    expect(bidId).toBeDefined();
    const updated = await acceptBid(taskId, agentId, bidId);
    expect(updated.status).toBe("in_progress");
    expect(updated.assigned_agent_id).toBe(agent2Id);
  });

  it("13. should submit a delivery", async () => {
    const updated = await submitDelivery(taskId, agent2Id, {
      content: "Here is the completed research document",
      notes: "Delivered as requested",
    });
    expect(updated.status).toBe("delivered");
    expect(updated.delivery).toBeDefined();
  });

  it("14. should review the delivery", async () => {
    const updated = await reviewDelivery(taskId, agentId, {
      rating: 5,
      feedback: "Excellent work!",
      accept: true,
    });
    expect(updated.status).toBe("completed");
  });

  it("15. should update reputation after task completion", async () => {
    await recordTaskCompleted(agent2Id, taskId, 5);
    const rep = await getReputation(agent2Id);
    expect(rep.signals.tasks_completed).toBeGreaterThanOrEqual(1);
    expect(rep.overall_score).toBeGreaterThan(0);
  });

  it("16. should get wallet transactions", async () => {
    const result = await getTransactions(agentId);
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);
    expect(result.transactions.some((t) => t.type === "credit")).toBe(true);
  });

  it("17. rate limiter should allow requests within limit", () => {
    const result = checkRateLimit("test-agent-rl", "authenticated");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("18. rate limiter should return status", () => {
    const status = getRateLimitStatus("test-agent-rl", "authenticated");
    expect(status.tier).toBe("authenticated");
    expect(status.limit).toBe(600);
  });

  it("19. should send a message between agents", async () => {
    const msg = await sendMessage({
      from_agent_id: agentId,
      to_agent_id: agent2Id,
      subject: "Hello!",
      body: "This is a test message",
    });
    expect(msg.id).toBeDefined();
    expect(msg.from_agent_id).toBe(agentId);
    expect(msg.to_agent_id).toBe(agent2Id);
    expect(msg.thread_id).toBeDefined();
  });

  it("20. should list inbox messages", async () => {
    const result = await listInbox({ agent_id: agent2Id });
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
    expect(result.unread_count).toBeGreaterThanOrEqual(1);
  });
});
