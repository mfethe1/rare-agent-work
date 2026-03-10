"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setKeys(data || []);
    }
    setLoading(false);
  };

  const createKey = async () => {
    setError(null);
    if (!newKeyName.trim()) {
      setError("Please enter a name for the key");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    // Generate a simple random key string
    const keyValue = `raw_sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const { error } = await supabase.from("api_keys").insert([{
      user_id: userData.user.id,
      key_value: keyValue,
      name: newKeyName.trim()
    }]);

    if (error) {
      setError(error.message);
    } else {
      setNewKeyName("");
      fetchKeys();
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      fetchKeys();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-white">API Keys</h1>
      <p className="mb-8 text-slate-400">Manage your API keys for programmatic access to our Agent Context API.</p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-red-200 border border-red-500/50">
          {error}
        </div>
      )}

      <div className="mb-12 rounded-xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-xl font-semibold text-white">Create New Key</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Key Name (e.g. Production Agent)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 rounded-lg border border-white/20 bg-black px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
          />
          <button
            onClick={createKey}
            className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold text-black transition-colors hover:bg-cyan-400"
          >
            Generate Key
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
        <h2 className="mb-6 text-xl font-semibold text-white">Your Keys</h2>
        {loading ? (
          <p className="text-slate-400">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="text-slate-400">No API keys generated yet.</p>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 p-4">
                <div>
                  <h3 className="font-medium text-white">{key.name || "Unnamed Key"}</h3>
                  <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
                    <code className="rounded bg-white/10 px-2 py-1 font-mono text-cyan-300">
                      {key.key_value}
                    </code>
                    <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="rounded px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
