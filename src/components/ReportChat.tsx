'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GateState {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}

interface ReportChatProps {
  reportSlug?: string;
  placeholder?: string;
}

export default function ReportChat({ reportSlug, placeholder }: ReportChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<GateState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading || gate) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages((m) => [...m, assistantMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          reportSlug,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));

        if (res.status === 401) {
          setGate({
            title: 'Free preview used — sign in to keep going',
            body: payload.error ?? 'Create an account or sign in to continue.',
            ctaHref: payload.upgradeUrl ?? '/auth/login',
            ctaLabel: 'Sign in',
          });
        } else if (res.status === 402 || res.status === 403) {
          setGate({
            title: 'Upgrade to unlock the AI assistant',
            body: payload.error ?? 'This feature is available on paid plans.',
            ctaHref: payload.upgradeUrl ?? '/pricing',
            ctaLabel: 'View plans',
          });
        }

        throw new Error('Request failed');
      }

      if (!res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Access required or request failed. See the prompt below to continue.',
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-80 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            Ask anything about implementation, setup, or how to apply the concepts in this report. Your first question is free — then we’ll ask you to sign in.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200 border border-gray-700'
              }`}
            >
              {m.content || (loading && i === messages.length - 1 ? '▋' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {gate && (
        <div className="bg-blue-950/50 border border-blue-500/40 rounded-lg p-4 mb-3 text-sm text-center">
          <p className="text-white font-semibold mb-1">{gate.title}</p>
          <p className="text-gray-400 mb-3">{gate.body}</p>
          <a
            href={gate.ctaHref}
            className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {gate.ctaLabel}
          </a>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={placeholder ?? 'Ask about implementation...'}
          disabled={loading || !!gate}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim() || !!gate}
          className="bg-blue-600 text-white px-5 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2 text-center">
        Paid feature · Powered by Claude Sonnet 4.6
      </p>
    </div>
  );
}
