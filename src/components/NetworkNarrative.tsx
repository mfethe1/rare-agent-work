import Link from 'next/link';

const trustPillars = [
  {
    title: 'Curated operators, not anonymous agents',
    body:
      'The network starts with named builders and specialist shops Michael already trusts. This is not an open marketplace and it is not an auto-routing black box.',
    accent: 'text-cyan-300',
    border: 'border-cyan-400/20',
    bg: 'bg-cyan-500/5',
  },
  {
    title: 'Scoped introductions with a clear brief',
    body:
      'Every match begins with a narrow problem definition, delivery boundary, and risk notes so both sides know exactly what is being evaluated before any deeper access is granted.',
    accent: 'text-fuchsia-300',
    border: 'border-fuchsia-400/20',
    bg: 'bg-fuchsia-500/5',
  },
  {
    title: 'Evidence before expansion',
    body:
      'Teams earn broader trust through references, artifacts, and execution quality. The network is designed to compound confidence, not bypass it.',
    accent: 'text-emerald-300',
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-500/5',
  },
];

const discoveryFlow = [
  {
    step: '01',
    title: 'Map the work',
    body:
      'Define the workflow, stakes, systems touched, and what success actually looks like. If the brief is vague, the match will be vague too.',
  },
  {
    step: '02',
    title: 'Match on trust + fit',
    body:
      'Route the opportunity toward operators who have relevant technical depth, domain context, and a level of access that fits the risk of the project.',
  },
  {
    step: '03',
    title: 'Run a scoped engagement',
    body:
      'Start with an audit, architecture sprint, or tightly bounded implementation block. The first job is to create evidence, not dependency.',
  },
];

const useCases = [
  'You need a high-trust introduction to someone who can actually ship agent infrastructure.',
  'You want a neutral architecture opinion before you commit your team to a toolchain or multi-agent pattern.',
  'You are exploring agent-to-agent collaboration models and need an operator-grade sanity check before productizing them.',
];

export default function NetworkNarrative() {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-3">
        {trustPillars.map((pillar) => (
          <article
            key={pillar.title}
            className={`rounded-[1.75rem] border ${pillar.border} ${pillar.bg} p-7 backdrop-blur-sm`}
          >
            <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${pillar.accent}`}>Trust model</p>
            <h2 className="mt-3 text-2xl font-bold text-white">{pillar.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">What the network is</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">A discovery layer for serious agent work</h2>
          <div className="mt-5 space-y-4 text-base leading-8 text-slate-300">
            <p>
              The Agent Network is the first public surface for Rare Agent Work&apos;s A2A strategy: a way to connect real teams,
              real operators, and real implementation needs without pretending trust is solved by a logo wall.
            </p>
            <p>
              Think of it as a guided introduction layer. Rare Agent Work frames the opportunity, pressure-tests the ask,
              and helps the right people find each other before anyone overcommits to architecture, access, or long-term vendor relationships.
            </p>
            <p>
              The goal is simple: reduce coordination drag for high-value agent work while keeping trust, proof, and human judgment in the loop.
            </p>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Good fit right now</p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-200">
            {useCases.map((useCase) => (
              <li key={useCase} className="flex gap-3">
                <span className="mt-0.5 text-cyan-300">✓</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-[#07111f]/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current shape</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Early access, curated matches, and consulting-led discovery. Deliberately small, deliberately high-signal.
            </p>
          </div>
        </aside>
      </section>

      <section className="mt-16 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-300">How discovery works</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Start narrow, prove fit, then deepen the relationship</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            A2A is powerful when it behaves like a disciplined operating model instead of a vague promise. The network is designed to create enough structure for momentum without making the process feel bureaucratic.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {discoveryFlow.map((item) => (
            <div key={item.step} className="rounded-[1.5rem] border border-white/10 bg-[#07111f]/80 p-6">
              <span className="text-sm font-semibold text-cyan-300">{item.step}</span>
              <h3 className="mt-3 text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/5 p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">Early access</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Join the first wave</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            If you want in early, the fastest path is to describe the project, the stakes, and what kind of counterpart you need.
            The goal is not volume. The goal is a small number of credible matches that actually move work forward.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/assessment"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              Request early access
            </Link>
            <a
              href="mailto:hello@rareagent.work?subject=Agent%20Network%20early%20access"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Email the brief
            </a>
          </div>
        </article>

        <article className="rounded-[2rem] border border-fuchsia-400/20 bg-fuchsia-500/5 p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-300">Consulting-led route</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Need help shaping the match?</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            For higher-stakes work, start with a consulting sprint. Michael can help turn a fuzzy request into a scoped brief,
            pressure-test the trust model, and decide whether the best answer is advice, an introduction, or direct involvement.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/book-demo"
              className="inline-flex items-center justify-center rounded-full bg-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300"
            >
              Book a discovery call
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Read the research first
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
