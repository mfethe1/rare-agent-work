'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const OWNER_EMAIL = 'michael.fethe@protelynx.ai';

interface Draft {
  id: string;
  slug: string;
  title: string;
  content: string;
  version: string;
  changes_summary: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes: string | null;
  created_by: string;
  created_at: string;
  reviewed_at: string | null;
}

export default function ReviewPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if the current user is Michael (owner)
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === OWNER_EMAIL) {
        setAuthorized(true);
      }
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  const loadDrafts = useCallback(async () => {
    const res = await fetch('/api/drafts');
    if (res.ok) {
      const data = await res.json();
      setDrafts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  async function handleAction(status: 'approved' | 'rejected') {
    if (!selected) return;
    setActing(true);
    await fetch('/api/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, status, reviewer_notes: notes }),
    });
    setSelected(null);
    setNotes('');
    setActing(false);
    loadDrafts();
  }

  const pending = drafts.filter((d) => d.status === 'pending');
  const reviewed = drafts.filter((d) => d.status !== 'pending');

  const statusBadge = (s: string) => {
    if (s === 'pending') return 'bg-yellow-500/20 text-yellow-400';
    if (s === 'approved') return 'bg-green-500/20 text-green-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="text-xl font-bold tracking-tighter text-white">Rare Agent Work</a>
          <span className="text-sm text-gray-400">Report Review Dashboard</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!authChecked ? (
          <p className="text-gray-500">Checking authorization...</p>
        ) : !authorized ? (
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8 text-center max-w-md mx-auto mt-16">
            <h2 className="text-xl font-bold text-white mb-3">Owner Access Only</h2>
            <p className="text-gray-400 mb-4">
              This dashboard is restricted to the site owner. Please sign in with the owner account.
            </p>
            <a
              href="/auth/login?redirect=/review"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Sign In
            </a>
          </div>
        ) : loading ? (
          <p className="text-gray-500">Loading drafts...</p>
        ) : selected ? (
          /* Draft detail view */
          <div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-white mb-4 text-sm transition-colors"
            >
              ← Back to list
            </button>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(selected.status)}`}>
                  {selected.status.toUpperCase()}
                </span>
                <span className="text-gray-500 text-sm">v{selected.version}</span>
                <span className="text-gray-600 text-xs">by {selected.created_by}</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{selected.title}</h1>
              {selected.changes_summary && (
                <p className="text-blue-400 text-sm mb-4 bg-blue-950/30 p-3 rounded-lg">
                  📝 Changes: {selected.changes_summary}
                </p>
              )}
              <div className="prose prose-invert max-w-none mt-6 border-t border-gray-800 pt-6">
                <div
                  className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                  style={{ maxHeight: '60vh', overflowY: 'auto' }}
                >
                  {selected.content}
                </div>
              </div>
            </div>

            {selected.status === 'pending' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">Your Review</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes (feedback, change requests...)"
                  rows={3}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction('approved')}
                    disabled={acting}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                  >
                    ✅ Approve & Publish
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={acting}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <>
            <h1 className="text-2xl font-bold text-white mb-6">Report Drafts — Awaiting Your Review</h1>

            {pending.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mb-8">
                <p className="text-gray-400">No pending drafts. All caught up! 🎉</p>
              </div>
            ) : (
              <div className="space-y-3 mb-10">
                {pending.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="w-full text-left bg-gray-900 border border-yellow-500/30 rounded-xl p-5 hover:border-yellow-500/60 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{d.title}</span>
                        <div className="text-sm text-gray-500 mt-1">
                          v{d.version} • {d.slug} • {new Date(d.created_at).toLocaleDateString()}
                        </div>
                        {d.changes_summary && (
                          <p className="text-gray-400 text-sm mt-1">{d.changes_summary}</p>
                        )}
                      </div>
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                        PENDING
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {reviewed.length > 0 && (
              <>
                <h2 className="text-lg font-semibold text-gray-400 mb-4">Previously Reviewed</h2>
                <div className="space-y-2">
                  {reviewed.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className="w-full text-left bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-gray-300">{d.title}</span>
                          <span className="text-gray-600 text-sm ml-3">v{d.version}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(d.status)}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
