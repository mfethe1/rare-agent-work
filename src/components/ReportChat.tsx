'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ReportChatProps {
  reportSlug?: string;
  placeholder?: string;
}

export default function ReportChat({ reportSlug, placeholder }: ReportChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const FREE_LIMIT = 5;

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    if (msgCount >= FREE_LIMIT) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setMsgCount((c) => c + 1);

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

      if (!res.ok || !res.body) throw new Error('Request failed');

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
          content: 'Sorry, something went wrong. Please try again.',
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  const atLimit = msgCount >= FREE_LIMIT;

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-80 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            Ask anything about implementation, setup, or how to apply the concepts in this report.
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

      {/* Limit banner */}
      {atLimit && (
        <div className="bg-blue-950/50 border border-blue-500/40 rounded-lg p-4 mb-3 text-sm text-center">
          <p className="text-white font-semibold mb-1">Free questions used ({FREE_LIMIT}/{FREE_LIMIT})</p>
          <p className="text-gray-400 mb-3">Subscribe for unlimited access to the AI guide + all reports updated every 3 days.</p>
          <a
            href="/pricing"
            className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Upgrade to Operator Access — $49/mo
          </a>
        </div>
      )}

      {/* Input */}
      {!atLimit && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={placeholder ?? 'Ask about implementation...'}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-5 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? '...' : 'Ask'}
          </button>
        </div>
      )}
      <p className="text-xs text-gray-600 mt-2 text-center">
        {FREE_LIMIT - msgCount} free questions remaining · Powered by Gemini 3.1 Pro
      </p>
    </div>
  );
}
