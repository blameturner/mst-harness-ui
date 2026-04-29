import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { useEffect, useState } from 'react';
import type { AgentSchedule } from '../api/types/AgentSchedule';
import { listSchedules } from '../api/schedules/listSchedules';
import { updateSchedule } from '../api/schedules/updateSchedule';
import { listWorkerTypes } from '../api/models/listWorkerTypes';
import { CronPicker } from '../components/CronPicker';

function AgentsEditPage() {
  const { id } = Route.useParams();
  const scheduleId = Number(id);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      listSchedules(),
      listWorkerTypes().catch(() => ({ types: [] })),
    ]).then(([schedRes, wtRes]) => {
      setWorkerTypes(wtRes.types);
      const sched = schedRes.schedules.find(
        (s: AgentSchedule) => s.id === scheduleId,
      );
      if (sched) {
        setForm({
          agent_name: sched.agent_name,
          cron_expression: sched.cron_expression,
          timezone: sched.timezone,
          task_description: sched.task_description,
          product: sched.product ?? '',
          active: sched.active,
        });
      } else {
        setError('Schedule not found');
      }
      setLoading(false);
    }).catch((err) => {
      setError((err as Error).message);
      setLoading(false);
    });
  }, [scheduleId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateSchedule(scheduleId, form);
      if (res.reload_warning) {
        setError(`Saved, but scheduler reload warning: ${res.reload_warning}`);
      } else {
        navigate({ to: '/agents' });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-bg text-fg font-sans px-8 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-baseline gap-6">
        <Link to="/agents" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
          ← agents
        </Link>
        <h1 className="font-display text-2xl tracking-tightest">Edit schedule</h1>
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

          <CronPicker
            value={form.cron_expression}
            onChange={(cron) => setForm({ ...form, cron_expression: cron })}
            timezone={form.timezone}
            onTimezoneChange={(tz) => setForm({ ...form, timezone: tz })}
          />

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
              {submitting ? 'saving…' : 'save'}
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

export const Route = createFileRoute('/agents/edit/$id')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: AgentsEditPage,
});
