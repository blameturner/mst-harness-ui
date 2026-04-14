import { useEffect, useState } from 'react';
import { getHarnessStats } from '../../../api/harness/getHarnessStats';
import type { HarnessStats } from '../../../api/types/HarnessStats';
import { formatNumber } from '../../../lib/utils/formatNumber';
import { styleLabel } from '../../../lib/styles/styleLabel';
import { StatCard } from '../components/StatCard';
import { DailyChart } from '../components/DailyChart';
import { Heatmap } from '../components/Heatmap';
import { relDate } from '../utils/relDate';

export function StatsTab() {
  const [stats, setStats] = useState<HarnessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    setLoading(true);
    setError(null);
    getHarnessStats(period)
      .then((r) => setStats(r))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [period]);

  const periods: { id: '7d' | '30d' | 'all'; label: string }[] = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: 'all', label: 'All time' },
  ];

  return (
    <div className="px-8 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Usage statistics</h2>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-sans border transition-colors',
                period === p.id
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs font-sans text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted">Loading stats…</div>
      ) : !stats ? (
        <div className="text-sm text-muted">No stats data available — is the harness running?</div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total requests" value={stats.total_requests.toLocaleString()} />
            <StatCard label="Conversations" value={stats.total_conversations.toLocaleString()} />
            <StatCard label="Tokens in" value={formatNumber(stats.total_tokens_input)} />
            <StatCard label="Tokens out" value={formatNumber(stats.total_tokens_output)} />
            <StatCard
              label="Error rate"
              value={stats.total_requests > 0 ? `${((stats.total_errors / stats.total_requests) * 100).toFixed(1)}%` : '0%'}
              sub={`${stats.total_errors} failed`}
            />
          </div>

          {stats.by_model.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Model performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                      <th className="text-left py-2">model</th>
                      <th className="text-right py-2">requests</th>
                      <th className="text-right py-2">tokens in</th>
                      <th className="text-right py-2">tokens out</th>
                      <th className="text-right py-2">avg tok/req</th>
                      <th className="text-right py-2">avg</th>
                      <th className="text-right py-2">p50</th>
                      <th className="text-right py-2">p95</th>
                      <th className="text-right py-2">p99</th>
                      <th className="text-right py-2">TTFT</th>
                      <th className="text-right py-2">errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_model.map((m) => (
                      <tr key={m.model_name} className="border-b border-border hover:bg-panelHi">
                        <td className="py-2 font-sans text-xs font-medium">{m.model_name}</td>
                        <td className="py-2 text-right font-mono text-xs">{m.requests.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{formatNumber(m.tokens_input)}</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{formatNumber(m.tokens_output)}</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.avg_tokens_per_request.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.avg_duration_seconds.toFixed(1)}s</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.p50_duration_seconds.toFixed(1)}s</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.p95_duration_seconds.toFixed(1)}s</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.p99_duration_seconds.toFixed(1)}s</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{m.time_to_first_token_ms > 0 ? `${m.time_to_first_token_ms}ms` : 'N/A'}</td>
                        <td className={`py-2 text-right font-mono text-xs ${m.error_count > 0 ? 'text-red-400' : 'text-muted'}`}>
                          {m.error_count > 0 ? `${m.error_count} (${(m.error_rate * 100).toFixed(1)}%)` : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {stats.by_model.map((m) => {
                  const ratio = m.tokens_input > 0 ? m.tokens_output / m.tokens_input : 0;
                  return (
                    <div key={m.model_name} className="border border-border rounded px-3 py-2 text-center min-w-[100px]">
                      <div className="text-sm font-medium font-mono">{ratio.toFixed(2)}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{m.model_name}</div>
                      <div className="text-[9px] text-muted mt-0.5">out/in ratio</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {stats.by_day.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Daily activity</h3>
              <DailyChart days={stats.by_day} />
            </section>
          )}

          {stats.by_hour.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Active hours</h3>
              <p className="text-xs text-muted mb-3">When you use the system most. Darker = more requests.</p>
              <Heatmap data={stats.by_hour} />
            </section>
          )}

          {stats.by_style.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">By style</h3>
              <div className="flex flex-wrap gap-3">
                {stats.by_style.map((s) => {
                  const pct = stats.total_requests > 0 ? ((s.requests / stats.total_requests) * 100).toFixed(0) : '0';
                  return (
                    <div key={s.style} className="border border-border rounded px-3 py-2 text-center min-w-[90px]">
                      <div className="text-sm font-medium">{s.requests}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{styleLabel(s.style)}</div>
                      <div className="text-[9px] text-muted mt-0.5">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {stats.agent_runs.total_runs > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Agent runs</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <StatCard label="Total runs" value={stats.agent_runs.total_runs.toLocaleString()} />
                <StatCard
                  label="Success rate"
                  value={`${((stats.agent_runs.successful / stats.agent_runs.total_runs) * 100).toFixed(0)}%`}
                  sub={`${stats.agent_runs.successful} ok / ${stats.agent_runs.failed} failed`}
                />
                <StatCard label="Avg steps" value={stats.agent_runs.avg_steps.toFixed(1)} />
              </div>
              {stats.agent_runs.by_agent.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                      <th className="text-left py-2">agent</th>
                      <th className="text-right py-2">runs</th>
                      <th className="text-right py-2">success rate</th>
                      <th className="text-right py-2">avg steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agent_runs.by_agent.map((a) => (
                      <tr key={a.agent_name} className="border-b border-border hover:bg-panelHi">
                        <td className="py-2 font-sans text-xs">{a.agent_name}</td>
                        <td className="py-2 text-right font-mono text-xs">{a.runs}</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{(a.success_rate * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right font-mono text-xs text-muted">{a.avg_steps.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {stats.top_conversations.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Top conversations</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                    <th className="text-left py-2">title</th>
                    <th className="text-right py-2">messages</th>
                    <th className="text-right py-2">tokens</th>
                    <th className="text-right py-2">last active</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_conversations.map((c) => (
                    <tr key={c.conversation_id} className="border-b border-border hover:bg-panelHi">
                      <td className="py-2 text-xs truncate max-w-[300px]">{c.title || `#${c.conversation_id}`}</td>
                      <td className="py-2 text-right font-mono text-xs">{c.message_count}</td>
                      <td className="py-2 text-right font-mono text-xs text-muted">{formatNumber(c.total_tokens)}</td>
                      <td className="py-2 text-right text-xs text-muted">{relDate(c.last_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
