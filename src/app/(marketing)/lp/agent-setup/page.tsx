import { Metadata } from "next";
import Link from "next/link";
import BuyButton from "@/components/BuyButton";

export const metadata: Metadata = {
  title: "How to Set Up Your First AI Agent in 60 Minutes",
  description:
    "Step-by-step operator playbook to build a production-safe AI workflow with human approval gates — no code required. Platform comparison, failure modes, and copy-paste templates included.",
  alternates: { canonical: "https://rareagent.work/lp/agent-setup" },
  openGraph: {
    title: "Set Up Your First AI Agent in 60 Minutes — Operator Playbook",
    description:
      "Compare Zapier vs Make vs n8n vs Relevance AI. Build a production-safe workflow with human-in-the-loop gates. $29 one-time.",
    url: "https://rareagent.work/lp/agent-setup",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function AgentSetupLanding() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-white font-bold tracking-tighter">
            Rare Agent Work
          </Link>
          <BuyButton
            plan="report_60"
            label="Get the Playbook — $29"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-blue-400 text-sm font-semibold mb-4 uppercase tracking-wider">
          Operator Playbook · $29 one-time
        </p>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
          Set Up Your First AI Agent
          <br />
          <span className="text-blue-500">in 60 Minutes</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 leading-relaxed">
          Stop reading tutorials that never work in production. This playbook
          gives you the exact platform comparison, implementation timeline, and
          human-in-the-loop templates to ship a working AI workflow today.
        </p>

        {/* Pain points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {[
            {
              icon: "⚡",
              title: "Platform Decision Matrix",
              desc: "Zapier vs Make vs n8n vs Relevance AI — honest comparison vendors won't give you",
            },
            {
              icon: "🗺️",
              title: "60-Minute Timeline",
              desc: "Scope lock → trigger → action chain → approval gates — phase by phase",
            },
            {
              icon: "🛡️",
              title: "Human-in-the-Loop Templates",
              desc: "Pre-built approval gates for emails, charges, and public posts",
            },
            {
              icon: "🔥",
              title: "Failure Mode Playbook",
              desc: "8 common failures with exact diagnosis steps — hallucination loops, auth expiry, webhook timeouts",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="border border-blue-500/20 rounded-xl p-5 bg-gray-900/40"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof / credibility */}
        <div className="border border-gray-800 rounded-xl p-6 mb-12 text-center">
          <p className="text-gray-300 text-lg font-medium mb-2">
            Built from real production deployments — not demos.
          </p>
          <p className="text-gray-500 text-sm">
            Updated every 3 days with fresh research. Content refreshed
            automatically.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center bg-blue-950/20 border border-blue-500/30 rounded-2xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">
            Start building in the next hour
          </h2>
          <p className="text-gray-400 mb-6">
            One-time purchase. No subscription required. Full report access
            instantly.
          </p>
          <BuyButton
            plan="report_60"
            label="Get Agent Setup Playbook — $29"
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          />
          <p className="text-gray-600 text-xs mt-4">
            Or{" "}
            <Link
              href="/reports/agent-setup-60"
              className="text-blue-400 hover:underline"
            >
              read the free preview first →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
