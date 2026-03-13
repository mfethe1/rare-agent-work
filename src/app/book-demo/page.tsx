import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Book a Demo | Rare Agent Work",
  description: "Schedule a high-ticket B2B consultation and demo of operator-grade AI agent systems.",
};

export default function BookDemoPage() {
  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950 flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                <Image src="/logo-medallion.jpg" alt="Rare Agent Work logo" fill className="object-cover" sizes="40px" priority />
              </div>
              <div>
                <span className="block text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/90">Rare Agent</span>
                <span className="block text-base font-bold tracking-tight text-white">Work</span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/news" className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">News Feed</Link>
              <Link href="/reports" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</Link>
              <Link href="/about" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">About</Link>
              <Link href="/assessment" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Strategy & Architecture</p>
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Book an Operator Demo</h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            Schedule a direct consultation with Michael to review your agentic workflow, architecture, and deployment risk.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            This path is best when the issue is strategic, high-stakes, or tied to architecture and rollout decisions rather than a simple report purchase.
          </p>
        </div>

        <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.03] p-2 backdrop-blur-sm shadow-[0_0_40px_rgba(34,211,238,0.05)]">
          <div className="aspect-video w-full rounded-[1.5rem] bg-[#0f172a] overflow-hidden flex items-center justify-center border border-white/5">
            {/* Cal.com embed simulation for demo purposes */}
            <div className="text-center p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 text-2xl">
                📅
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Select a Date & Time</h3>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                Integration with Cal.com will render here. For now, please use our assessment form or email directly.
              </p>
              <Link href="/assessment" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300">
                Continue to Assessment Form →
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="mt-auto border-t border-white/10 py-8 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} Rare Agent Work. Bespoke operator-grade AI research and news.</p>
      </footer>
    </div>
  );
}
