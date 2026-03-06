'use client';

import { useState } from 'react';

interface Model {
  id: string;
  slug: string;
  name: string;
  provider: string;
  tool_use_score: number;
  context_recall_score: number;
  coding_score: number;
  cost_per_1k_tokens: number;
  context_window: number;
  best_for: string[];
  pricing_url?: string;
}

type SortKey = 'tool_use_score' | 'context_recall_score' | 'coding_score' | 'cost_per_1k_tokens' | 'context_window';

interface ModelsTableProps {
  models: Model[];
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 9 ? 'bg-green-500' : score >= 8 ? 'bg-blue-500' : score >= 7 ? 'bg-yellow-500' : 'bg-gray-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-gray-300">{score.toFixed(1)}</span>
    </div>
  );
}

export default function ModelsTable({ models }: ModelsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('tool_use_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...models].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900/80 border-b border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Model</th>
            <SortHeader col="tool_use_score" label="Tool Use" />
            <SortHeader col="context_recall_score" label="Context Recall" />
            <SortHeader col="coding_score" label="Coding" />
            <SortHeader col="cost_per_1k_tokens" label="Cost/1k" />
            <SortHeader col="context_window" label="Context" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Best For</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {sorted.map((model, idx) => (
            <tr key={model.id} className="hover:bg-gray-900/40 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {idx === 0 && <span className="text-yellow-400 text-xs">★</span>}
                  <div>
                    <div className="font-semibold text-white">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.provider}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3"><ScoreBar score={model.tool_use_score} /></td>
              <td className="px-4 py-3"><ScoreBar score={model.context_recall_score} /></td>
              <td className="px-4 py-3"><ScoreBar score={model.coding_score} /></td>
              <td className="px-4 py-3">
                <span className="font-mono text-gray-300 text-xs">
                  ${model.cost_per_1k_tokens < 0.001
                    ? `${(model.cost_per_1k_tokens * 1000000).toFixed(0)}μ`
                    : model.cost_per_1k_tokens.toFixed(4)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-gray-300 text-xs">
                  {model.context_window >= 1_000_000
                    ? `${(model.context_window / 1_000_000).toFixed(0)}M`
                    : `${(model.context_window / 1000).toFixed(0)}k`}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {model.best_for.map(tag => (
                    <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
