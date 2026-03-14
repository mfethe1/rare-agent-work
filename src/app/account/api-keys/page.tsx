"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  key_value: string;
  name: string;
  created_at: string;
}

/**
 * Generate a cryptographically secure API key.
 * Uses Web Crypto API (available in all modern browsers).
 */
function generateSecureKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // Convert to url-safe base64, then trim padding
  const raw = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `raw_sk_${raw}`;
}

/**
 * Mask a key value, showing only the prefix and last 4 characters.
 * e.g. raw_sk_****...****abcd
 */
function maskKey(key: string): string {
  if (key.length <= 12) return key;
  const prefix = key.slice(0, 7); // "raw_sk_"
  const suffix = key.slice(-4);
  return `${prefix}${"*".repeat(8)}...${suffix}`;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  // Newly created key shown once — cleared on next action
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = typeof window !== "undefined" ? createClient() : null;

  const fetchKeys = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    const { data: userData, error: userError } =
      await supabase.auth.getUser();
    if (userError || !userData?.user) {
      router.push("/auth/login");
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setKeys((data as ApiKey[]) || []);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = async () => {
    if (!supabase) return;

    setError(null);
    setRevealedKey(null);
    setCopied(false);

    const trimmed = newKeyName.trim();
    if (!trimmed) {
      setError("Enter a name for the key (e.g. Production Agent).");
      return;
    }
    if (trimmed.length > 64) {
      setError("Key name must be 64 characters or fewer.");
      return;
    }

    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth/login");
      return;
    }

    const keyValue = generateSecureKey();

    const { error: insertError } = await supabase.from("api_keys").insert([
      {
        user_id: userData.user.id,
        key_value: keyValue,
        name: trimmed,
      },
    ]);

    if (insertError) {
      setError(insertError.message);
    } else {
      setNewKeyName("");
      setRevealedKey(keyValue);
      await fetchKeys();
    }
    setCreating(false);
  };

  const deleteKey = async (id: string) => {
    if (!supabase) return;

    setRevokingId(id);
    setRevealedKey(null);
    const { error: deleteError } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await fetchKeys();
    }
    setRevokingId(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      {/* Minimal top bar */}
      <nav className="border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/account"
              className="text-slate-400 transition-colors hover:text-white"
            >
              Account
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-semibold text-white">API Keys</span>
          </div>
          <Link
            href="/docs"
            className="text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
          >
            API Docs
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Manage keys for programmatic access to the Agent Context API.
            Keys are shown <strong className="text-slate-300">once</strong> at
            creation — store them securely.
          </p>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-900/20 p-4">
            <span className="mt-0.5 shrink-0 text-red-400">!</span>
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto shrink-0 text-xs text-red-400 transition-colors hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Revealed key banner — shown once after creation */}
        {revealedKey && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-900/15 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Key created — copy it now
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  This is the only time the full key will be shown. Store it in
                  a secrets manager or .env file.
                </p>
              </div>
              <button
                onClick={() => setRevealedKey(null)}
                className="shrink-0 text-xs text-slate-500 transition-colors hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-500/20 bg-black/40 px-3 py-2 font-mono text-sm text-emerald-300">
                {revealedKey}
              </code>
              <button
                onClick={() => copyToClipboard(revealedKey)}
                className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Create new key */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Create new key
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Key name (e.g. Production Agent)"
              value={newKeyName}
              maxLength={64}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createKey();
              }}
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              onClick={createKey}
              disabled={creating}
              className="shrink-0 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Generating..." : "Generate Key"}
            </button>
          </div>
        </section>

        {/* Existing keys */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-semibold text-white">Your keys</h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-black/30 p-4"
                >
                  <div>
                    <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                    <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/6" />
                  </div>
                  <div className="h-7 w-16 animate-pulse rounded bg-white/8" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-black/20 p-6 text-center">
              <p className="text-sm text-slate-500">
                No API keys yet. Create one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/30 p-4 transition-colors hover:border-white/12"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {key.name || "Unnamed Key"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <code className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-slate-400">
                        {maskKey(key.key_value)}
                      </code>
                      <span>
                        Created{" "}
                        {new Date(key.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteKey(key.id)}
                    disabled={revokingId === key.id}
                    className="shrink-0 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revokingId === key.id ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Security note */}
        <p className="mt-6 text-center text-[11px] text-slate-600">
          Keys are generated using the Web Crypto API. Full key values are shown
          once at creation and masked afterwards.
        </p>
      </main>
    </div>
  );
}
