export interface Report {
  slug: string;
  planKey: string;
  title: string;
  subtitle: string;
  price: string;
  priceLabel: string;
  audience: string;
  valueprop: string;
  deliverables: { icon: string; title: string; desc: string }[];
  excerpt: { heading: string; body: string }[];
  chatPlaceholder: string;
  color: string;
}

export const reports: Record<string, Report> = {
  'agent-setup-60': {
    slug: 'agent-setup-60',
    planKey: 'report_60',
    title: 'Agent Setup in 60 Minutes',
    subtitle: 'Low-code operator playbook for first-time builders',
    price: '$29',
    priceLabel: 'one-time',
    audience: 'Founders, operators, and non-technical teams launching their first workflow',
    valueprop: 'Build a production-safe AI workflow with human approval gates in under 60 minutes — without writing code.',
    deliverables: [
      { icon: '⚡', title: 'Platform Selection Guide', desc: 'Zapier vs Make vs n8n vs Relevance AI — exact criteria for your use case, budget, and team size.' },
      { icon: '🗺️', title: '60-Minute Implementation Timeline', desc: 'Phase-by-phase breakdown: scoping (10min), trigger setup (15min), action chain (20min), approval gates + test (15min).' },
      { icon: '🛡️', title: 'Human-in-the-Loop Gate Templates', desc: 'Pre-built approval patterns for sensitive actions. Never let your agent send an email or charge a card without a human sign-off.' },
      { icon: '🔥', title: 'Failure Mode Playbook', desc: '8 common failure modes with exact diagnosis steps and fixes. Covers hallucination loops, auth expiry, webhook timeouts.' },
      { icon: '📋', title: 'Full Example Workflow', desc: 'Customer support triage: Typeform → AI classifier → Slack approval → response draft. Copy-paste ready.' },
      { icon: '🔄', title: 'Weekly Optimization Checklist', desc: 'Structured process to review, tune, and expand your workflow without breaking what\'s already working.' },
    ],
    excerpt: [
      {
        heading: 'Choosing Your Platform: The Decision Matrix',
        body: `The single biggest mistake first-time builders make is choosing a platform based on brand recognition rather than fit. Here is the honest comparison that vendors won't give you.

**Zapier** is the right choice if your team has zero technical background and you need to connect two well-known SaaS tools. Its strength is breadth — 6,000+ app integrations — and its weakness is depth. Complex branching logic becomes a maintenance nightmare, and pricing scales aggressively past 750 tasks/month. Best for: solo founders, executive assistants, simple notification workflows.

**Make (formerly Integromat)** is the best all-around choice for operators who want visual power without code. Its module-based builder handles complex conditional logic cleanly, HTTP modules let you call any API, and pricing stays reasonable at scale. The learning curve is real but worth it. Best for: operations teams, mid-complexity automation, startups that will outgrow Zapier.

**n8n** wins on economics and flexibility at the cost of setup time. Self-hosted deployment means near-zero per-execution costs once running, and its code nodes let technical operators drop into JavaScript when the visual builder hits its limits. Best for: technical teams, high-volume workflows, organizations with data sovereignty requirements.

**Relevance AI** is the right choice when your workflow requires an agent that reasons across steps — not just routes data. It handles tool-use patterns, memory, and multi-step inference natively. Best for: knowledge work automation, customer-facing AI assistants, workflows requiring judgment rather than just routing.`,
      },
      {
        heading: 'The 60-Minute Implementation Protocol',
        body: `**Minutes 0–10: Scope Lock**
Before opening any platform, write down: (1) the exact trigger event, (2) the exact output you want, (3) every human decision point in the current manual process. If you can't describe the workflow in three sentences, you're not ready to automate it. Ambiguous scope is the #1 cause of workflows that work in testing and fail in production.

**Minutes 10–25: Trigger Setup**
Configure your entry point and test it with real data — not sample data. Synthetic test cases hide edge cases that will bite you in week two. Run at least three real trigger events before moving to the action chain.

**Minutes 25–45: Action Chain**
Build each action step and test it in isolation before connecting them. Add explicit error handling at every step that touches external systems. The question to ask at each node: "What happens if this fails at 2am when no one is watching?"

**Minutes 45–60: Approval Gates + Production Test**
Insert your human-in-the-loop checkpoint for any action that is irreversible (send email, create record, charge card, post publicly). Run the full workflow end-to-end twice with production data. Document the rollback procedure before you ship.`,
      },
    ],
    chatPlaceholder: 'Which platform should I use for my use case? How do I set up approval gates?',
    color: 'blue',
  },

  'single-to-multi-agent': {
    slug: 'single-to-multi-agent',
    planKey: 'report_multi',
    title: 'From Single Agent to Multi-Agent',
    subtitle: 'How to scale from one assistant to an orchestrated team',
    price: '$79',
    priceLabel: 'one-time',
    audience: 'Engineering teams and technical leads scaling execution across multiple workflows',
    valueprop: 'Architect a coordinated multi-agent system with proper memory layers, role separation, and production-safe failure handling.',
    deliverables: [
      { icon: '🔬', title: 'Framework Comparison Matrix', desc: 'CrewAI vs LangGraph vs AutoGen vs OpenAI Swarm — production-readiness, memory support, learning curve, cost model.' },
      { icon: '🧠', title: 'Three-Tier Memory Architecture', desc: 'L1 conversation buffer, L2 session summarization, L3 persistent vector store. Blueprint for agents that actually remember.' },
      { icon: '🔄', title: 'Planner-Executor-Reviewer Loop', desc: 'Role definition, handoff protocol, and failure recovery pattern. Annotated code walkthrough included.' },
      { icon: '📊', title: 'Framework Transition Matrix', desc: 'When to migrate from single to multi, and which migration path minimizes production risk.' },
      { icon: '⚠️', title: 'Coordination Failure Playbook', desc: 'Deadlock detection, loop prevention, and graceful degradation when agents go off-script.' },
      { icon: '🏗️', title: 'Production Architecture Blueprint', desc: 'Full system diagram: orchestrator, worker agents, shared memory layer, observability hooks.' },
    ],
    excerpt: [
      {
        heading: 'Selecting Your Framework: Production Reality Check',
        body: `Most framework comparisons are written by people who have run demos, not production systems. Here is what actually matters after the honeymoon phase.

**CrewAI** has the gentlest learning curve and the most opinionated structure. You define Agents with roles, goals, and backstories; you define Tasks with descriptions and expected outputs; and CrewAI handles the orchestration. This structure is its strength and its constraint. When your use case fits the Crew mental model cleanly, it ships fast. When it doesn't, you fight the framework. Production verdict: excellent for knowledge work pipelines with well-defined roles (research → write → review). Struggles with dynamic task graphs and stateful long-running processes.

**LangGraph** is the most powerful option and the most demanding. It models your agent system as a directed graph with explicit state management at each node. This gives you complete control over execution flow, conditional branching, and human-in-the-loop interrupts. The cost is cognitive overhead. Production verdict: the right choice for teams building complex, stateful workflows where they need to reason precisely about what happens at every step. Not the right choice if you need to ship in a week.

**AutoGen** optimizes for conversational multi-agent interaction. Its model of "conversations between agents" is intuitive and powerful for tasks that benefit from back-and-forth refinement. It handles code execution natively and has strong support for human-in-the-loop patterns. Production verdict: strong choice for code generation, analysis, and tasks requiring iterative refinement. Less suited for structured pipelines with strict output requirements.`,
      },
      {
        heading: 'Memory Architecture: Why Your Agent Keeps Forgetting',
        body: `The single most common failure mode in multi-agent systems is the agent that works perfectly in a fresh session and fails mysteriously in session four. The culprit is almost always memory architecture — specifically, the absence of one.

**L1: Conversation Buffer (always required)** — The raw message history for the current session. Every framework gives you this for free, and every team forgets it has a context window limit. At ~32k tokens, your agent starts losing the beginning of the conversation. Mitigation: implement a rolling window with summary injection.

**L2: Session Summarization (implement in week two)** — A compressed representation of what happened in past sessions, injected into the system prompt at the start of each new conversation. Without this, your agent treats every session as if it has never worked with you before. Implementation: after each session ends, run a summarization call and store the result in a key-value store indexed by user/project ID.

**L3: Persistent Vector Store (implement before scaling to teams)** — Semantic search over accumulated knowledge: past decisions, project context, institutional patterns. This is what makes an agent feel like it actually knows your business rather than a stateless tool you have to re-educate every time. Implementation: embed key artifacts (decisions, summaries, code patterns) into a vector database (pgvector, Pinecone, Weaviate) and retrieve top-k on each new task.`,
      },
    ],
    chatPlaceholder: 'Which framework should I use? How do I implement memory for my agents?',
    color: 'green',
  },

  'empirical-agent-architecture': {
    slug: 'empirical-agent-architecture',
    planKey: 'report_empirical',
    title: 'Agent Architecture: Empirical Research Edition',
    subtitle: 'Production-grade evaluation, reproducibility, and governance',
    price: '$299',
    priceLabel: 'one-time',
    audience: 'Technical leaders, architects, and B2B operators deploying AI at scale',
    valueprop: 'Build a defensible, reproducible evaluation protocol and governance framework for production AI systems.',
    deliverables: [
      { icon: '📐', title: 'Evaluation Protocol Template', desc: 'Task decomposition accuracy, tool use precision, hallucination rate, latency P95 — complete measurement framework.' },
      { icon: '⚖️', title: 'LLM-as-Judge Calibration Guide', desc: 'Inter-rater reliability scoring, bias correction checklist, and calibration procedure for consistent evaluation.' },
      { icon: '📊', title: 'Sample Scorecard with Confidence Intervals', desc: '5 metrics × 3 model variants. Real statistical methodology for defensible comparisons.' },
      { icon: '🏛️', title: '12-Item Pre-Production Governance Checklist', desc: 'The checklist that catches the failure modes most teams discover in production instead of staging.' },
      { icon: '🔁', title: 'Reproducibility Reporting Standard', desc: 'Document exactly what it takes to reproduce your evaluation results. Critical for model rotation decisions.' },
      { icon: '📋', title: 'Benchmark Design Patterns', desc: 'How to design benchmarks that measure what matters — not just what\'s easy to measure.' },
    ],
    excerpt: [
      {
        heading: 'Why Most Agent Evaluations Are Unreliable',
        body: `The evaluation problem in agent systems is significantly harder than in static NLP benchmarks, and most teams underestimate this by an order of magnitude. A static model evaluation asks: given input X, does the model produce output Y? An agent evaluation asks: given environment E and goal G, does the agent achieve G over a trajectory of N steps, using tools T, while satisfying constraints C? The state space explodes combinatorially.

Three failure modes dominate production evaluation programs:

**Evaluating the demo, not the distribution.** Teams build evaluation sets from their best-case examples — clear prompts, cooperative environments, well-specified goals. Production traffic is messier: ambiguous requests, edge cases, adversarial inputs, compounding errors. An agent that scores 94% on a curated benchmark and 71% on production traffic is not a rare exception. It is the norm.

**Treating LLM-as-judge as ground truth without calibration.** Using a capable model (GPT-4o, Claude Sonnet) to evaluate agent outputs is a valid and scalable methodology. The problem is that uncalibrated judge models have systematic biases: they favor longer responses, responses that sound confident, and responses that match their own stylistic patterns. Without a calibration step against human judgments on a representative sample, your eval pipeline has an unknown and potentially large systematic error.

**Ignoring trajectory evaluation in favor of output evaluation.** If your agent uses 14 tool calls to accomplish a task that should require 3, and produces the correct final output, most output-only evaluation systems will score it as a success. In production, that 14-call trajectory means higher latency, higher cost, higher error probability, and worse user experience. Trajectory efficiency is a first-class metric.`,
      },
      {
        heading: 'The Pre-Production Governance Checklist',
        body: `These 12 items represent the failure modes that teams consistently discover in production rather than staging. Work through this list before declaring any agent system production-ready.

1. **Idempotency verification** — Every irreversible action (send, create, charge, post) has been tested for duplicate execution. What happens if the agent runs the same action twice?

2. **Rate limit handling** — All external API calls have retry logic with exponential backoff. The agent degrades gracefully when rate-limited rather than looping.

3. **Context window exhaustion test** — What happens in session 50, after the context is full? Has this been tested explicitly?

4. **Adversarial prompt test** — Has the system been tested against prompt injection via user input, retrieved documents, and tool outputs?

5. **Tool failure cascade test** — What happens when a tool the agent depends on returns an error? Does the agent recover gracefully or spin?

6. **Human escalation path** — Is there a defined and tested path for the agent to escalate to a human when it detects it is operating outside its competence boundary?

7. **Audit log completeness** — Every agent action is logged with enough context to reconstruct the decision. Logs are stored outside the agent's own memory.

8. **Cost budget enforcement** — There is a hard ceiling on token spend and tool call count per session, enforced at the infrastructure level, not the prompt level.

9. **PII handling verification** — Any personally identifiable information that enters the agent's context has a documented handling policy and is not logged in plaintext.

10. **Rollback procedure** — There is a documented and tested procedure to reverse any action the agent can take that has real-world consequences.

11. **Model version pinning** — The production deployment is pinned to a specific model version. Automatic model updates are disabled.

12. **Evaluation pipeline coverage** — The automated eval pipeline covers at least 80% of the task categories present in production traffic.`,
      },
    ],
    chatPlaceholder: 'How do I calibrate LLM-as-judge? What metrics should I track in production?',
    color: 'purple',
  },
};

export function getReport(slug: string): Report | null {
  return reports[slug] ?? null;
}

export function getAllReports(): Report[] {
  return Object.values(reports);
}
