import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500 selection:text-white font-sans">
      {/* Navigation */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold tracking-tighter text-white">Rare Agent Work</span>
            </div>
            <div>
              <a href="#contact" className="bg-white text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors">
                Book a Consultation
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8">
            Fractional <span className="text-blue-500">Autonomous Squads</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-10 leading-relaxed">
            We build and lease highly-specialized, context-aware AI teams. Stop buying wrapper apps and start leasing digital workforces that remember your business logic, tech debt, and safety rails.
          </p>
          <div className="flex justify-center gap-4">
            <a href="#contact" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">
              Deploy Your Squad
            </a>
            <a href="/Agentic_Illusion_Strategic_Brief.pdf" target="_blank" rel="noopener noreferrer" className="border border-gray-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-all">
              Read Q1 2026 Strategy Brief
            </a>
          </div>
        </div>
      </main>

      {/* Core Philosophy */}
      <section className="bg-gray-900 border-y border-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Context, State, and Safety.</h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            A 200 IQ foundation model is useless if it hallucinates a database drop, forgets what happened yesterday, or gets stuck in a loop. We sell the plumbing (persistent memory, safety gating, orchestration), not just the water (raw AI models).
          </p>
        </div>
      </section>

      {/* Offerings Section */}
      <section id="offerings" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Offering 1 */}
          <div className="bg-black border border-gray-800 p-8 rounded-xl hover:border-gray-600 transition-colors">
            <div className="h-12 w-12 bg-blue-900/50 rounded-lg flex items-center justify-center mb-6 border border-blue-500/30">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">The Autonomous Ops Team</h3>
            <p className="text-gray-400 mb-6">
              Lease a pre-configured, multi-agent squad that drops directly into your GitHub and Slack. Powered by our proprietary memU persistent memory layer, they learn your tech debt and institutional quirks over time.
            </p>
            <p className="text-sm font-semibold text-gray-300">Retainers from $5k - $10k/mo</p>
          </div>

          {/* Offering 2 */}
          <div className="bg-black border border-gray-800 p-8 rounded-xl hover:border-gray-600 transition-colors">
            <div className="h-12 w-12 bg-green-900/50 rounded-lg flex items-center justify-center mb-6 border border-green-500/30">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Agentic System Hardening</h3>
            <p className="text-gray-400 mb-6">
              Building your own agents? We install the safety rails. We implement Idempotency Gates and Temporal workflow wrappers to ensure your AI cannot destroy production databases or spam clients.
            </p>
            <p className="text-sm font-semibold text-gray-300">Custom High-Ticket Integrations</p>
          </div>

          {/* Offering 3 */}
          <div className="bg-black border border-gray-800 p-8 rounded-xl hover:border-gray-600 transition-colors">
            <div className="h-12 w-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-6 border border-purple-500/30">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Hyper-Niche Legacy Integration</h3>
            <p className="text-gray-400 mb-6">
              Generic AI hates messy, 1990s ERPs, physical hardware, and strict compliance pipelines. We specialize our agents to bridge state-of-the-art intelligence into brittle legacy systems.
            </p>
            <p className="text-sm font-semibold text-gray-300">Custom Enterprise Solutions</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-20 bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to scale your autonomous workforce?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Let's discuss how our memU infrastructure and fractional squads can integrate directly into your operations.
          </p>
          <a href="mailto:hello@rareagent.work" className="inline-block bg-white text-black px-10 py-4 rounded-lg text-lg font-bold hover:bg-gray-200 transition-colors">
            Contact Sales
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Rare Agent Work. All rights reserved.</p>
      </footer>
    </div>
  );
}
