import { Metadata } from "next";
import Link from "next/link";
import BuyButton from "@/components/BuyButton";

export const metadata: Metadata = {
  title: "From Single Agent to Multi-Agent Orchestration — Production Guide",
  description:
    "Scale from one AI assistant to a coordinated team. Framework comparison, three-tier memory architecture, and the planner-executor-reviewer loop used in production systems.",
  alternates: { canonical: "https://rareagent.work/lp/multi-agent" },
  openGraph: {
    title: "Multi-Agent Orchestration Guide — $79",
    description:
      "Framework comparison, memory architecture, and orchestration patterns for production multi-agent systems.",
    url: "https://rareagent.work/lp/multi-agent",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function MultiAgentLanding() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-white font-bold tracking-tighter">
            Rare Agent Work
          </Link>
          <BuyButton
            plan="report_multi"
            label="Get the Guide — $79"
            className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-green-400 text-sm font-semibold mb-4 uppercase tracking-wider">
          Production Guide · $79 one-time
        </p>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
          Scale to Multi-Agent
          <br />
          <span className="text-green-500">Without the Chaos</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 leading-relaxed">
          Most framework comparisons are written by people who ran demos, not
          production systems. This guide covers what actually matters after the
          honeymoon phase — memory, coordination, and failure recovery.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {[
            {
              icon: "🔬",
              title: "Framework Comparison Matrix",
              desc: "LangGraph vs CrewAI vs Autogen vs custom — honest production reality check",
            },
            {
              icon: "🧠",
              title: "Three-Tier Memory Architecture",
              desc: "Working memory, episodic memory, and semantic memory — when and how to use each",
            },
            {
              icon: "🔄",
              title: "Planner-Executor-Reviewer Loop",
              desc: "The orchestration pattern that works in production — with failure recovery",
            },
            {
              icon: "📊",
              title: "Cost & Latency Modeling",
              desc: "Predict costs before you scale — token budgets, caching strategies, and fallback chains",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="border border-green-500/20 rounded-xl p-5 bg-gray-900/40"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center bg-green-950/20 border border-green-500/30 rounded-2xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">
            Stop guessing at architecture
          </h2>
          <p className="text-gray-400 mb-6">
            One-time purchase. Includes framework decision matrix, memory
            architecture templates, and orchestration patterns.
          </p>
          <BuyButton
            plan="report_multi"
            label="Get Multi-Agent Guide — $79"
            className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20"
          />
          <p className="text-gray-600 text-xs mt-4">
            Or{" "}
            <Link
              href="/reports/single-to-multi-agent"
              className="text-green-400 hover:underline"
            >
              read the free preview first →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
