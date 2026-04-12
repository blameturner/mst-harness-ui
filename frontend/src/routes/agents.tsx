import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { AgentSchedule } from '../api/types/AgentSchedule';
import type { AgentSummary } from '../api/types/AgentSummary';
import { listAgents } from '../api/agents/listAgents';
import { listSchedules } from '../api/schedules/listSchedules';
import { deleteSchedule as deleteScheduleReq } from '../api/schedules/deleteSchedule';
import { humaniseCron } from '../components/CronPicker';
import { authClient } from '../lib/auth-client';

function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [a, s] = await Promise.all([listAgents(), listSchedules()]);
      setAgents(a.agents);
      setSchedules(s.schedules);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteSchedule(id: number) {
    if (!confirm('Delete this schedule?')) return;
    try {
      const res = await deleteScheduleReq(id);
      if (res.reload_warning) {
        setError(`Deleted, but: ${res.reload_warning}`);
      }
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link to="/chat" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
            ← back
          </Link>
          <h1 className="font-display text-2xl tracking-tightest">Agents</h1>
        </div>
        <Link
          to="/agents/new"
          className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors"
        >
          + new agent
        </Link>
      </header>

      <main className="px-8 py-6 space-y-10">
        {error && <div className="text-xs font-sans text-red-700">{error}</div>}

        <section>
          <h2 className="font-display text-xl mb-3">Registered agents</h2>
          {loading ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : agents.length === 0 ? (
            <div className="text-sm text-muted font-sans">No agents.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
                  <th className="text-left py-2">name</th>
                  <th className="text-left py-2">display</th>
                  <th className="text-left py-2">model</th>
                  <th className="text-left py-2">worker type</th>
                  <th className="text-right py-2">actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.Id} className="border-b border-border hover:bg-panelHi">
                    <td className="py-2 font-sans text-xs">{a.name}</td>
                    <td className="py-2">{a.display_name ?? '—'}</td>
                    <td className="py-2 font-sans text-xs">{a.model ?? '—'}</td>
                    <td className="py-2 font-sans text-xs">{a.worker_type ?? '—'}</td>
                    <td className="py-2 text-right">
                      <Link
                        to="/agents/$id"
                        params={{ id: String(a.Id) }}
                        className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
                      >
                        detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl mb-3">Schedules</h2>
          {loading ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : schedules.length === 0 ? (
            <div className="text-sm text-muted font-sans">No schedules.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
                  <th className="text-left py-2">agent</th>
                  <th className="text-left py-2">cron</th>
                  <th className="text-left py-2">tz</th>
                  <th className="text-left py-2">product</th>
                  <th className="text-left py-2">active</th>
                  <th className="text-right py-2">actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-panelHi">
                    <td className="py-2 font-sans text-xs">{s.agent_name}</td>
                    <td className="py-2 font-sans text-xs" title={s.cron_expression}>{humaniseCron(s.cron_expression)}</td>
                    <td className="py-2 font-sans text-xs">{s.timezone}</td>
                    <td className="py-2 text-xs">{s.product || '—'}</td>
                    <td className="py-2 text-xs">{s.active ? 'yes' : 'no'}</td>
                    <td className="py-2 text-right space-x-3">
                      <Link
                        to="/agents/edit/$id"
                        params={{ id: String(s.id) }}
                        className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg"
                      >
                        edit
                      </Link>
                      <button
                        onClick={() => deleteSchedule(s.id)}
                        className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-red-700"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/agents')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AgentsPage,
});
