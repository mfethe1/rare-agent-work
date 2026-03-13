'use client';

import { useState } from 'react';

const initialState = {
  name: '',
  email: '',
  company: '',
  useCase: '',
  budget: '',
  timeline: '',
  confirmsNoCredentials: false,
  confirmsHumanReview: false,
};

export default function ConsultingForm() {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (!form.confirmsNoCredentials || !form.confirmsHumanReview) {
      setError('Please confirm the trust requirements before submitting.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/consulting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      setMessage('Request sent. Michael will get the details by email.');
      setForm(initialState);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof typeof initialState>(key: K, value: (typeof initialState)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} data-testid="consulting-form" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="you@company.com"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Company</span>
          <input
            value={form.company}
            onChange={(e) => updateField('company', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="Company or project"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Timeline</span>
          <input
            value={form.timeline}
            onChange={(e) => updateField('timeline', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. This month"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Budget</span>
          <input
            value={form.budget}
            onChange={(e) => updateField('budget', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. $5k-$15k"
          />
        </label>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-sm text-gray-400">
          Best for audits, agent strategy, deployment design, and implementation help.
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">What do you need help with?</span>
        <textarea
          required
          rows={5}
          value={form.useCase}
          onChange={(e) => updateField('useCase', e.target.value)}
          className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          placeholder="Tell us about the team, current stack, goals, and blockers."
        />
      </label>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5 text-sm leading-7 text-blue-100">
        Use this form for scoping and review. Do not include passwords, API keys, private repos that require shared credentials, or production secrets.
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-200">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.confirmsNoCredentials} onChange={(e) => updateField('confirmsNoCredentials', e.target.checked)} className="mt-1" />
          <span>I confirm I have removed credentials and secrets.</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.confirmsHumanReview} onChange={(e) => updateField('confirmsHumanReview', e.target.checked)} className="mt-1" />
          <span>I understand this path is for human review and scoped follow-up, not immediate autonomous execution.</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        data-testid="consulting-submit"
        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Request consulting access'}
      </button>

      <p className="text-xs text-gray-500">
        Typical first response: within one business day for qualified requests.
      </p>

      <p className="text-xs text-gray-500">
        Prefer email? Use{' '}
        <a href="mailto:hello@rareagent.work?subject=Rare%20Agent%20Work%20assessment" className="text-blue-400 hover:text-blue-300">
          hello@rareagent.work
        </a>
        .
      </p>

      {message && <p className="text-sm text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
