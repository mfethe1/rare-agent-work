'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  trackSubmitWorkStart,
  trackSubmitWorkStepComplete,
  trackSubmitWorkSubmit,
  trackSubmitWorkValidationError,
} from '@/lib/analytics';

const requestTypes = [
  'Architecture Review',
  'Implementation Rescue',
  'Curated Specialist Match',
] as const;

const initialState = {
  requestType: requestTypes[0],
  name: '',
  email: '',
  company: '',
  projectTitle: '',
  currentState: '',
  desiredOutcome: '',
  constraints: '',
  timeline: '',
  budgetBand: '',
  sensitivity: 'Normal',
  links: '',
  confirmsNoCredentials: false,
  confirmsHumanReview: false,
  confirmsNoAutoExecution: false,
  agreesRetention: false,
  website: '',
};

export default function SubmitWorkForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  function markStarted() {
    if (started) return;
    setStarted(true);
    trackSubmitWorkStart({ page_path: '/submit-work', page_type: 'submit_work', intake_variant: 'single_form' });
  }

  function updateField<K extends keyof typeof initialState>(key: K, value: (typeof initialState)[K]) {
    markStarted();
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    markStarted();
    setLoading(true);
    setError(null);

    if (!form.confirmsNoCredentials || !form.confirmsHumanReview || !form.confirmsNoAutoExecution || !form.agreesRetention) {
      const message = 'Please confirm the trust and consent requirements before submitting.';
      setError(message);
      trackSubmitWorkValidationError({ step_name: 'consent', field_name: 'checkboxes', error_type: 'required', intake_variant: 'single_form' });
      setLoading(false);
      return;
    }

    trackSubmitWorkStepComplete({ step_name: 'brief', step_number: 1, intake_variant: 'single_form' });
    trackSubmitWorkStepComplete({ step_name: 'consent', step_number: 2, intake_variant: 'single_form' });

    try {
      const res = await fetch('/api/submit-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Submission failed.');
        trackSubmitWorkValidationError({ step_name: 'submit', field_name: 'server', error_type: 'server', intake_variant: 'single_form' });
        return;
      }

      trackSubmitWorkSubmit({
        intake_variant: 'single_form',
        submission_type: form.requestType,
        self_reported_budget_band: form.budgetBand || 'unspecified',
      });
      router.push('/submit-work/thanks');
    } catch {
      setError('Network error. Please try again.');
      trackSubmitWorkValidationError({ step_name: 'submit', field_name: 'network', error_type: 'server', intake_variant: 'single_form' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => updateField('website', e.target.value)}
        className="hidden"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Request type</span>
          <select
            required
            value={form.requestType}
            onChange={(e) => updateField('requestType', e.target.value as (typeof requestTypes)[number])}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            {requestTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Project title</span>
          <input
            required
            value={form.projectTitle}
            onChange={(e) => updateField('projectTitle', e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            placeholder="What needs to get shipped?"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Name</span>
          <input required value={form.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="Your name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Email</span>
          <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="you@company.com" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Company</span>
          <input value={form.company} onChange={(e) => updateField('company', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="Company or project" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Timeline</span>
          <input value={form.timeline} onChange={(e) => updateField('timeline', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="e.g. This month" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Budget band</span>
          <input value={form.budgetBand} onChange={(e) => updateField('budgetBand', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="e.g. $5k-$15k" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">Sensitivity</span>
          <select value={form.sensitivity} onChange={(e) => updateField('sensitivity', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none">
            <option>Normal</option>
            <option>Confidential</option>
            <option>Trust-sensitive</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">Current state</span>
        <textarea required rows={4} value={form.currentState} onChange={(e) => updateField('currentState', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="What exists today, where it breaks, and what context matters?" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">Desired outcome</span>
        <textarea required rows={4} value={form.desiredOutcome} onChange={(e) => updateField('desiredOutcome', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="What does a successful next step look like?" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">Constraints / artifacts / links</span>
        <textarea value={form.constraints} onChange={(e) => updateField('constraints', e.target.value)} rows={3} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="Links, repos, docs, Figma, constraints, blockers, trust boundaries." />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">Additional links</span>
        <input value={form.links} onChange={(e) => updateField('links', e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" placeholder="https://..." />
      </label>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-7 text-amber-100">
        Do not include passwords, API keys, private keys, session cookies, or any production credentials. This form is for discovery and scoping only.
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-200">
        <label className="flex items-start gap-3"><input type="checkbox" checked={form.confirmsNoCredentials} onChange={(e) => updateField('confirmsNoCredentials', e.target.checked)} className="mt-1" /><span>I confirm I have removed credentials and secrets.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={form.confirmsHumanReview} onChange={(e) => updateField('confirmsHumanReview', e.target.checked)} className="mt-1" /><span>I understand this is human-reviewed before any next step.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={form.confirmsNoAutoExecution} onChange={(e) => updateField('confirmsNoAutoExecution', e.target.checked)} className="mt-1" /><span>I understand there will be no direct autonomous execution against client systems from this intake.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={form.agreesRetention} onChange={(e) => updateField('agreesRetention', e.target.checked)} className="mt-1" /><span>I consent to temporary storage for up to 90 days for review and triage.</span></label>
      </div>

      <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60">
        {loading ? 'Submitting…' : 'Submit Work (Beta)'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
