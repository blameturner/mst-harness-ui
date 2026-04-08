import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api, type Worker } from '../lib/api';
import { authClient } from '../lib/auth-client';
import { WorkerSelector } from '../components/WorkerSelector';
import { ChatMessage, type Message } from '../components/ChatMessage';

function uid() {
  return Math.random().toString(36).slice(2);
}

function ChatPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [active, setActive] = useState<Worker | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [product, setProduct] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .workers()
      .then((r) => {
        setWorkers(r.workers);
        setWorkersError(null);
        if (r.workers.length > 0) setActive(r.workers[0]);
      })
      .catch((err) => {
        // Surface the failure instead of pretending "no workers configured".
        console.error('[chat] failed to load workers', err);
        setWorkers([]);
        setWorkersError(
          (err as Error)?.message ?? 'Failed to load workers. Check gateway connectivity.',
        );
      })
      .finally(() => setLoadingWorkers(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || !active || sending) return;
    const userMsg: Message = { role: 'user', text, id: uid() };
    const pendingId = uid();
    setMessages((m) => [...m, userMsg, { role: 'pending', id: pendingId }]);
    setInput('');
    setSending(true);
    try {
      const res = await api.run({ agent_name: active.name, task: text, product });
      setMessages((m) =>
        m
          .filter((x) => x.id !== pendingId)
          .concat({ role: 'agent', output: res.output, id: uid() }),
      );
    } catch (err) {
      setMessages((m) =>
        m
          .filter((x) => x.id !== pendingId)
          .concat({
            role: 'agent',
            id: uid(),
            output: {
              title: 'Error',
              summary: (err as Error)?.message ?? 'Run failed',
              domain: '',
              key_points: [],
              recommendations: [],
              next_steps: [],
              observations: [],
              follow_up_questions: [],
              tags: [],
              confidence: 'low',
            },
          }),
      );
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await authClient.signOut();
    navigate({ to: '/login' });
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-panel/40 flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <h1 className="font-display text-lg font-bold">
            <span className="text-accent">Jeff</span>GPT
          </h1>
          <button onClick={logout} className="text-xs text-muted hover:text-text">
            Sign out
          </button>
        </div>
        <div className="p-3 overflow-y-auto flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2 px-1">Workers</p>
          <WorkerSelector
            workers={workers}
            active={active}
            onSelect={setActive}
            loading={loadingWorkers}
          />
          {workersError && (
            <p className="text-xs text-red-400 mt-2 px-1">{workersError}</p>
          )}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 ? (
              <div className="text-center text-muted pt-20">
                <p className="font-display text-2xl text-text mb-2">
                  {active ? active.display_name || active.name : 'Select a worker'}
                </p>
                <p className="text-sm">Ask anything. Responses are structured.</p>
              </div>
            ) : (
              messages.map((m) => <ChatMessage key={m.id} message={m} onFollowUp={send} />)
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-panel/40 px-6 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="max-w-3xl mx-auto flex items-center gap-3"
          >
            <input
              list="product-options"
              placeholder="product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-36 bg-panel border border-border px-3 py-2 rounded text-sm focus:border-accent outline-none"
            />
            <datalist id="product-options" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={active ? `Message ${active.display_name || active.name}…` : 'Select a worker first'}
              disabled={!active || sending}
              className="flex-1 bg-panel border border-border px-4 py-2.5 rounded focus:border-accent outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!active || !input.trim() || sending}
              className="bg-accent text-bg font-semibold px-5 py-2.5 rounded hover:bg-amber-400 transition disabled:opacity-50"
            >
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ChatPage,
});
