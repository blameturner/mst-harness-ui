import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';

function humaniseCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return '—';
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*') return 'every minute';
  if (hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return `every hour at :${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '*')
    return `every day at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return expr;
}

function AgentsNewPage() {
  const navigate = useNavigate();
  const [workerTypes, setWorkerTypes] = useState<
    { id: string; name: string; description: string }[]
  >([]);
  const [form, setForm] = useState({
    agent_name: '',
    cron_expression: '0 3 * * *',
    timezone: 'Australia/Sydney',
    task_description: '',
    product: '',
    active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.agents
      .workerTypes()
      .then((r) => setWorkerTypes(r.types))
      .catch(() => setWorkerTypes([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.schedules.create(form);
      if (res.reload_warning) {
        setError(`Created, but scheduler reload warning: ${res.reload_warning}`);
      } else {
        navigate({ to: '/agents' });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-baseline gap-6">
        <Link to="/agents" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
          ← agents
        </Link>
        <h1 className="font-display text-2xl tracking-tightest">New scheduled agent</h1>
      </header>

      <main className="px-8 py-6 max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Agent (worker type)
            </label>
            <input
              list="worker-types"
              value={form.agent_name}
              onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
              required
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
            />
            <datalist id="worker-types">
              {workerTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.description}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Task description
            </label>
            <textarea
              value={form.task_description}
              onChange={(e) => setForm({ ...form, task_description: e.target.value })}
              required
              rows={4}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-fg"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Product
            </label>
            <input
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-fg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
                Cron (5-field)
              </label>
              <input
                value={form.cron_expression}
                onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
                required
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
              />
              <div className="text-[10px] font-sans text-muted mt-1">
                {humaniseCron(form.cron_expression)} · no seconds, no aliases
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
                Timezone (IANA)
              </label>
              <input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                required
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
              />
              <div className="text-[10px] font-sans text-muted mt-1">
                e.g. Australia/Sydney — AEST/AEDT won't work
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span className="text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
              active
            </span>
          </label>

          {error && <div className="text-xs font-sans text-red-700">{error}</div>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-4 py-2 hover:bg-fg hover:text-bg disabled:opacity-50"
            >
              {submitting ? 'creating…' : 'create'}
            </button>
            <Link
              to="/agents"
              className="text-[11px] uppercase tracking-[0.18em] font-sans text-muted px-4 py-2"
            >
              cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/agents/new')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AgentsNewPage,
});
