import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type DockerContainer, type LlmModel } from '../lib/api';
import { gatewayUrl } from '../lib/runtime-env';
import { authClient } from '../lib/auth-client';
import { styleLabel } from '../lib/styles';
import { LogsPage } from './logs';
import { EnrichmentContent } from './enrichment';
import { formatNumber } from '../lib/utils/formatNumber';
import { extractPort } from '../lib/utils/extractPort';

type Tab = 'architecture' | 'enrichment' | 'logs' | 'stats';

interface HealthStatus {
  status: string;
  harness: string;
}

function HarnessPage() {
  const [tab, setTab] = useState<Tab>('architecture');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health()
      .then((r) => setHealth(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const harnessOk = health?.harness === 'ok';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'enrichment', label: 'Enrichment' },
    { id: 'logs', label: 'Logs' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tightest">Harness</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${harnessOk ? 'bg-fg' : health ? 'bg-muted' : 'bg-border animate-blink'}`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {loading
              ? 'Checking'
              : harnessOk
                ? 'All connected'
                : health
                  ? 'Harness unreachable'
                  : 'Gateway unreachable'}
          </span>
        </div>
      </header>

      <nav className="shrink-0 border-b border-border px-8 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'architecture' && <ArchitectureTab />}
        {tab === 'enrichment' && <EnrichmentContent />}
        {tab === 'logs' && <LogsPage />}
        {tab === 'stats' && <StatsTab />}
      </div>
    </div>
  );
}

/* ============================================================================
 * ARCHITECTURE TAB — dynamic stack diagram showing how everything connects
 * ========================================================================= */

const MODEL_ROLE_DESCRIPTIONS: Record<string, string> = {
  reasoner: 'Deep thinking model for complex reasoning, analysis, and multi-step problem solving.',
  coder: 'Specialised for code generation, refactoring, debugging, and technical tasks.',
  tool: 'Handles tool/function calling — decides when and how to invoke external tools.',
  fast: 'Low-latency model for quick responses, summaries, and lightweight tasks.',
  default: 'General-purpose model used when no specialised role is needed.',
};

const DATA_LAYER_INFO: Record<string, { role: string; detail: string }> = {
  redis: {
    role: 'Cache / message bus',
    detail: 'Caches model responses and session state. Also used as a pub/sub bus for real-time events between services.',
  },
  postgres: {
    role: 'Primary database',
    detail: 'Stores conversations, messages, agent runs, enrichment logs, and all persistent application data.',
  },
  nocodb: {
    role: 'Org / config store',
    detail: 'Provides a spreadsheet-like interface for managing organisation settings, user records, and configuration data.',
  },
  mysql: {
    role: 'NocoDB backend',
    detail: 'Backing database for the NocoDB instance.',
  },
};

function ArchitectureTab() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.logs.containers().then((r) => setContainers(r.containers)).catch(() => {}),
      api.models().then((r) => setModels(r.models)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const gw = gatewayUrl();

  // Classify containers into layers
  const dataContainers = containers.filter((c) => {
    const n = c.name.toLowerCase();
    const img = c.image.toLowerCase();
    return (
      n.includes('redis') || n.includes('postgres') || n.includes('nocodb') ||
      n.includes('mysql') || n.includes('mongo') ||
      img.includes('redis') || img.includes('postgres') || img.includes('nocodb')
    );
  });

  const serviceContainers = containers.filter((c) => {
    const n = c.name.toLowerCase();
    const img = c.image.toLowerCase();
    const isModel = n.includes('llama') || n.includes('model') || n.includes('reasoner') ||
      n.includes('coder') || n.includes('fast') || img.includes('llama') || img.includes('gguf') || img.includes('vllm');
    const isData = n.includes('redis') || n.includes('postgres') || n.includes('nocodb') ||
      n.includes('mysql') || n.includes('mongo') ||
      img.includes('redis') || img.includes('postgres') || img.includes('nocodb');
    const isProxy = n.includes('nginx') || n.includes('proxy') || n.includes('traefik') || n.includes('caddy') ||
      img.includes('nginx') || img.includes('proxy');
    return !isModel && !isData && !isProxy;
  });

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  if (loading) {
    return <div className="px-8 py-6 text-sm text-muted">Loading stack info…</div>;
  }

  return (
    <div className="px-8 py-6 space-y-10">
      {/* --- Call flow diagram --- */}
      <section>
        <h2 className="font-display text-xl mb-2">How a prompt flows through the stack</h2>
        <p className="text-sm text-muted leading-relaxed max-w-2xl mb-6">
          Click any component to see what it does.
        </p>

        <div className="border border-border rounded-lg bg-panel/30 p-6 space-y-6">
          {/* Row 1: User → Frontend → Gateway → Harness */}
          <div className="flex items-stretch gap-0 justify-center overflow-x-auto">
            <StackNode
              label="Browser"
              sub="React SPA"
              active={expanded === 'browser'}
              onClick={() => toggle('browser')}
            />
            <StackArrow label="HTTPS" />
            <StackNode
              label="Frontend"
              sub=":3000"
              active={expanded === 'frontend'}
              onClick={() => toggle('frontend')}
            />
            <StackArrow label="fetch / SSE" />
            <StackNode
              label="Gateway"
              sub={`:${extractPort(gw)}`}
              highlight
              active={expanded === 'gateway'}
              onClick={() => toggle('gateway')}
            />
            <StackArrow label="HTTP proxy" />
            <StackNode
              label="Harness"
              sub=":3800"
              highlight
              active={expanded === 'harness'}
              onClick={() => toggle('harness')}
            />
          </div>

          {/* Expanded detail for top row */}
          {expanded === 'browser' && (
            <DetailPanel title="Browser">
              The user interface. A static React single-page app that makes API calls to the gateway.
              It handles rendering conversations, streaming responses via EventSource, and managing
              the chat/code/agent UIs. Nothing is baked in — it reads the gateway URL from{' '}
              <code className="font-mono text-xs">/config.js</code> at runtime.
            </DetailPanel>
          )}
          {expanded === 'frontend' && (
            <DetailPanel title="Frontend container">
              Serves the static React build on port 3000. In production this is an nginx container
              that also injects runtime configuration (gateway URL, feature flags) via a generated{' '}
              <code className="font-mono text-xs">/config.js</code>.
            </DetailPanel>
          )}
          {expanded === 'gateway' && (
            <DetailPanel title="Gateway">
              The authentication and routing layer. It validates session cookies, resolves the user's
              org, then proxies requests to the harness over the internal Docker network. It also
              provides direct endpoints for Docker log streaming, org management, and serves as the
              SSE relay for streaming responses back to the browser without buffering.
            </DetailPanel>
          )}
          {expanded === 'harness' && (
            <DetailPanel title="Harness (core engine)">
              The orchestration brain. When a prompt arrives, the harness:
              <ol className="list-decimal list-inside mt-2 space-y-1 text-xs text-muted">
                <li>Selects the right model based on the task (chat, code, agent run)</li>
                <li>Builds the prompt with system instructions, conversation history, and enrichment data</li>
                <li>Sends inference requests to the appropriate model endpoint</li>
                <li>Streams structured output back (chunks, metadata, tool calls, parsed results)</li>
                <li>Manages agents, enrichment pipelines, scheduling, and conversation persistence</li>
              </ol>
            </DetailPanel>
          )}

          {/* Connector: Harness fans out to models */}
          <div className="border-t border-border pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-3 text-center">
              Harness dispatches to models by role
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {models.length > 0 ? (
                models.map((m) => {
                  const key = `model-${m.name}`;
                  const role = m.role ?? 'default';
                  return (
                    <button
                      key={m.name}
                      onClick={() => toggle(key)}
                      className={[
                        'border rounded-md p-3 text-left transition-all',
                        expanded === key
                          ? 'border-fg bg-fg text-bg'
                          : 'border-border bg-panel/40 hover:border-fg/40',
                      ].join(' ')}
                    >
                      <div className="text-xs font-medium font-sans">{m.name}</div>
                      <div className={`text-[10px] uppercase tracking-[0.12em] ${expanded === key ? 'text-bg/70' : 'text-muted'}`}>
                        {role}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-full text-sm text-muted text-center py-4">
                  No model endpoints found — is the harness running?
                </div>
              )}
            </div>

            {/* Model detail */}
            {models.map((m) => {
              const key = `model-${m.name}`;
              if (expanded !== key) return null;
              const role = m.role ?? 'default';
              const desc = MODEL_ROLE_DESCRIPTIONS[role] ?? MODEL_ROLE_DESCRIPTIONS.default;
              return (
                <DetailPanel key={key} title={m.name}>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Role:</span>{' '}
                      <span className="text-xs">{role}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Endpoint:</span>{' '}
                      <code className="font-mono text-xs">{m.url}</code>
                    </div>
                    {m.model_id && (
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Model ID:</span>{' '}
                        <code className="font-mono text-xs">{m.model_id}</code>
                      </div>
                    )}
                    <p className="text-xs text-muted leading-relaxed">{desc}</p>
                  </div>
                </DetailPanel>
              );
            })}
          </div>

          {/* Data layer */}
          <div className="border-t border-border pt-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-3 text-center">
              Data layer — the harness reads and writes to these stores
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {dataContainers.length > 0 ? (
                dataContainers.map((c) => {
                  const key = `data-${c.name}`;
                  const info = matchDataInfo(c.name);
                  return (
                    <button
                      key={c.name}
                      onClick={() => toggle(key)}
                      className={[
                        'border rounded-md p-3 text-left transition-all',
                        expanded === key
                          ? 'border-fg bg-fg text-bg'
                          : 'border-border bg-panel/40 hover:border-fg/40',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${c.state === 'running' ? 'bg-emerald-500' : 'bg-red-400'}`}
                        />
                        <span className="text-xs font-medium font-sans truncate">{c.name}</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${expanded === key ? 'text-bg/70' : 'text-muted'}`}>
                        {info?.role ?? 'data store'}
                      </div>
                    </button>
                  );
                })
              ) : (
                ['Redis', 'Postgres', 'NocoDB'].map((label) => (
                  <div key={label} className="border border-border rounded-md p-3 bg-panel/40 text-center">
                    <div className="text-xs font-medium text-muted">{label}</div>
                  </div>
                ))
              )}
            </div>

            {/* Data detail */}
            {dataContainers.map((c) => {
              const key = `data-${c.name}`;
              if (expanded !== key) return null;
              const info = matchDataInfo(c.name);
              return (
                <DetailPanel key={key} title={c.name}>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Image:</span>{' '}
                      <code className="font-mono text-xs">{c.image}</code>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Status:</span>{' '}
                      <span className="text-xs">{c.status}</span>
                    </div>
                    {info && <p className="text-xs text-muted leading-relaxed">{info.detail}</p>}
                  </div>
                </DetailPanel>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- Call flow step-by-step --- */}
      <section>
        <h2 className="font-display text-xl mb-4">Request lifecycle</h2>
        <p className="text-xs text-muted mb-4">What happens when you send a message.</p>
        <div className="border-t border-border">
          <FlowStep n={1} title="Browser sends prompt" endpoint="POST /api/chat"
            detail="The frontend POSTs the user message, selected style, and conversation ID to the gateway."
          />
          <FlowStep n={2} title="Gateway authenticates & forwards" endpoint="→ harness:3800"
            detail="Gateway validates the session cookie, resolves the org, and proxies the request to the harness over the Docker network."
          />
          <FlowStep n={3} title="Harness selects model & builds context" endpoint="internal"
            detail={`The harness picks the right model based on the task type (${models.map((m) => m.role ?? m.name).join(', ') || 'reasoner, coder, fast, tool'}). It assembles the full prompt with system instructions, conversation history, and enrichment data.`}
          />
          <FlowStep n={4} title="Inference request" endpoint="model endpoint"
            detail={`The assembled prompt is sent to the selected model endpoint. ${models.length > 0 ? `Currently ${models.length} model${models.length !== 1 ? 's' : ''} configured: ${models.map((m) => m.name).join(', ')}.` : ''}`}
          />
          <FlowStep n={5} title="Streaming response" endpoint="SSE /api/stream/{id}"
            detail="The model streams tokens back. The harness wraps them as SSE events (chunk, meta, searching, parsed, done) and relays through the gateway to the browser. Each event has an ID for cursor-based reconnection."
          />
          <FlowStep n={6} title="Persistence & enrichment" endpoint="Postgres"
            detail="Once complete, the conversation and messages are persisted. If enrichment is enabled, scraped content is processed and suggestions are generated for review."
          />
        </div>
      </section>

      {/* --- Running services --- */}
      <section>
        <h2 className="font-display text-xl mb-4">Running services</h2>
        {containers.length === 0 ? (
          <div className="text-sm text-muted py-4">No container data — is the Docker socket mounted?</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {containers.map((c) => (
              <div key={c.id} className="border border-border rounded-md p-3 bg-panel/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.state === 'running' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="font-mono text-xs font-medium">{c.name}</span>
                </div>
                <div className="font-mono text-[10px] text-muted truncate">{c.image}</div>
                <div className="text-[10px] text-muted mt-1">{c.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Network --- */}
      <section className="pb-6">
        <h2 className="font-display text-xl mb-4">Network</h2>
        <p className="text-sm text-muted leading-relaxed max-w-2xl mb-2">
          All containers share the{' '}
          <code className="font-mono text-xs text-fg">mst-ag-01-network</code>{' '}
          Docker bridge network. Internal traffic uses Docker DNS.
          Only the frontend (:3000) and gateway (:{extractPort(gw)}) expose ports to the host.
        </p>
        <div className="font-mono text-sm text-fg mt-3">{gw}</div>
        <div className="text-xs text-muted mt-1">
          Gateway URL — set via <code className="font-mono">GATEWAY_URL</code> env var.
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
 * STATS TAB — comprehensive usage, performance, and health metrics
 * ========================================================================= */

type UsageStats = Awaited<ReturnType<typeof api.harness.stats>>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatsTab() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.harness
      .stats(period)
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
      {/* Period selector */}
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
          {/* ── Overview cards ── */}
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

          {/* ── Model performance ── */}
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

              {/* Token efficiency — output/input ratio per model */}
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

          {/* ── Daily activity chart ── */}
          {stats.by_day.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Daily activity</h3>
              <DailyChart days={stats.by_day} />
            </section>
          )}

          {/* ── Active hours heatmap ── */}
          {stats.by_hour.length > 0 && (
            <section>
              <h3 className="font-display text-base mb-3">Active hours</h3>
              <p className="text-xs text-muted mb-3">When you use the system most. Darker = more requests.</p>
              <Heatmap data={stats.by_hour} />
            </section>
          )}

          {/* ── Styles ── */}
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

          {/* ── Agent runs ── */}
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

          {/* ── Top conversations ── */}
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

          {/* ── Enrichment ── */}
          <section>
            <h3 className="font-display text-base mb-3">Enrichment</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Cycles run" value={stats.enrichment.total_cycles.toLocaleString()} />
              <StatCard label="Sources scraped" value={stats.enrichment.total_sources_scraped.toLocaleString()} />
              <StatCard label="Tokens used" value={formatNumber(stats.enrichment.total_tokens_used)} />
              <StatCard
                label="Suggestions"
                value={stats.enrichment.suggestions_generated.toLocaleString()}
                sub={`${stats.enrichment.suggestions_approved} approved`}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Approval rate"
                value={stats.enrichment.suggestions_generated > 0
                  ? `${((stats.enrichment.suggestions_approved / stats.enrichment.suggestions_generated) * 100).toFixed(0)}%`
                  : '—'}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * SHARED COMPONENTS
 * ========================================================================= */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border rounded-md p-3 bg-panel/20">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">{label}</div>
      <div className="text-lg font-display tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted font-sans mt-0.5">{sub}</div>}
    </div>
  );
}

function StackNode({
  label, sub, highlight, active, onClick,
}: { label: string; sub: string; highlight?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center px-4 py-3 border rounded min-w-[90px] transition-all',
        active
          ? 'border-fg bg-fg text-bg ring-2 ring-fg/30 ring-offset-1 ring-offset-bg'
          : highlight
            ? 'border-fg bg-fg text-bg hover:ring-1 hover:ring-fg/30'
            : 'border-border bg-panel/40 hover:border-fg/40',
      ].join(' ')}
    >
      <span className="text-xs font-medium font-sans">{label}</span>
      <span className={`text-[10px] font-mono ${active || highlight ? 'text-bg/70' : 'text-muted'}`}>{sub}</span>
    </button>
  );
}

function StackArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 min-w-[60px]">
      <span className="text-[9px] uppercase tracking-[0.1em] text-muted font-sans mb-0.5">{label}</span>
      <div className="w-full h-px bg-border relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-border border-y-[3px] border-y-transparent" />
      </div>
    </div>
  );
}

function DetailPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-fg/20 rounded-md p-4 bg-panel/40 animate-in fade-in slide-in-from-top-1 duration-150">
      <h4 className="font-display text-sm mb-2">{title}</h4>
      <div className="text-xs text-muted leading-relaxed">{children}</div>
    </div>
  );
}

function FlowStep({
  n, title, endpoint, detail,
}: { n: number; title: string; endpoint: string; detail: string }) {
  return (
    <div className="border-b border-border py-4 grid grid-cols-[2rem_1fr] gap-x-4">
      <span className="font-mono text-xs text-muted tabular-nums pt-0.5">{n}</span>
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-sans font-medium">{title}</span>
          <span className="ml-auto font-mono text-[10px] text-muted">{endpoint}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function DailyChart({ days }: { days: UsageStats['by_day'] }) {
  const max = Math.max(...days.map((d) => d.requests), 1);
  return (
    <div>
      <div className="flex items-end gap-px h-40 border-b border-border">
        {days.map((d) => {
          const errPct = d.errors > 0 && d.requests > 0 ? (d.errors / d.requests) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {/* Error slice at top of bar */}
              {errPct > 0 && (
                <div
                  className="w-full bg-red-400/70 rounded-t-sm"
                  style={{ height: `${(d.errors / max) * 100}%` }}
                />
              )}
              <div
                className="w-full bg-fg/80 min-h-[2px] transition-all group-hover:bg-fg"
                style={{ height: `${((d.requests - d.errors) / max) * 100}%` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-fg text-bg text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.date}: {d.requests} req{d.errors > 0 ? ` · ${d.errors} err` : ''} · {formatNumber(d.tokens_input)} in
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-muted">{days[0]?.date ?? ''}</span>
        <span className="text-[9px] font-mono text-muted">{days[days.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}

/** Hour-of-day x day-of-week heatmap */
function Heatmap({ data }: { data: UsageStats['by_hour'] }) {
  // Build a 7x24 grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const d of data) {
    if (d.day_of_week >= 0 && d.day_of_week < 7 && d.hour >= 0 && d.hour < 24) {
      grid[d.day_of_week][d.hour] = d.requests;
    }
  }
  const max = Math.max(...data.map((d) => d.requests), 1);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `3rem repeat(24, 1fr)` }}>
        {/* Hour labels */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[8px] font-mono text-muted text-center py-1">
            {h.toString().padStart(2, '0')}
          </div>
        ))}
        {/* Rows */}
        {grid.map((row, dayIdx) => (
          <>
            <div key={`label-${dayIdx}`} className="text-[9px] font-sans text-muted flex items-center pr-2 justify-end">
              {DAY_LABELS[dayIdx]}
            </div>
            {row.map((count, hourIdx) => {
              const intensity = count / max;
              return (
                <div
                  key={`${dayIdx}-${hourIdx}`}
                  className="w-5 h-5 rounded-sm group relative"
                  style={{ backgroundColor: intensity > 0 ? `rgba(10, 10, 10, ${0.08 + intensity * 0.82})` : 'rgba(10, 10, 10, 0.04)' }}
                  title={`${DAY_LABELS[dayIdx]} ${hourIdx}:00 — ${count} requests`}
                >
                  {count > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-fg text-bg text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {count} req
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

// TODO: refactor to shared relTime after confirming 'just now' vs 's ago' UX
function relDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return iso;
  }
}

function matchDataInfo(containerName: string): { role: string; detail: string } | null {
  const n = containerName.toLowerCase();
  for (const [key, info] of Object.entries(DATA_LAYER_INFO)) {
    if (n.includes(key)) return info;
  }
  return null;
}

export const Route = createFileRoute('/harness')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: HarnessPage,
});
