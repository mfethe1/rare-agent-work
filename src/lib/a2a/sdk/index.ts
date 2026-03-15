/**
 * A2A Agent SDK — The Official Client for rareagent.work
 *
 * In the 2028 agentic future, APIs without SDKs don't get adopted.
 * This SDK is the bridge between "we have 158 endpoints" and
 * "agents actually build on our platform."
 *
 * Design principles:
 *   1. Type-safe: Every request/response is fully typed from shared types.
 *   2. Ergonomic: Fluent namespaced API (client.tasks.submit(), client.contracts.propose()).
 *   3. Resilient: Built-in retry with exponential backoff, rate-limit awareness.
 *   4. Observable: Every call returns typed results with rate-limit metadata.
 *   5. Minimal dependencies: Only uses fetch() — works in Node, Deno, Bun, browsers.
 *
 * Usage:
 *   import { A2AClient } from '@/lib/a2a/sdk';
 *
 *   const client = new A2AClient({
 *     baseUrl: 'https://rareagent.work',
 *     apiKey: 'a2a_live_...',
 *     agentId: 'agent_abc123',
 *   });
 *
 *   // Register
 *   const reg = await client.agents.register({ name: 'MyAgent', ... });
 *
 *   // Submit a task
 *   const task = await client.tasks.submit({ intent: 'news.query', input: { topic: 'AI' } });
 *
 *   // Poll for completion
 *   const result = await client.tasks.waitForCompletion(task.task_id);
 *
 *   // Subscribe to events
 *   const sub = await client.events.subscribe({
 *     name: 'task-watcher',
 *     topics: ['task.completed', 'task.failed'],
 *     webhookUrl: 'https://my-agent.example/hooks/a2a',
 *   });
 */

export { A2AClient } from './client';
export type { A2AClientConfig, A2ARequestOptions, A2AResponse } from './client';
export type {
  AgentsNamespace,
  TasksNamespace,
  ContractsNamespace,
  EventsNamespace,
  KnowledgeNamespace,
  ContextNamespace,
  BillingNamespace,
} from './namespaces';
