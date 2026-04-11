import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type DockerContainer, type LlmModel } from '../lib/api';
import { gatewayUrl } from '../lib/runtime-env';
import { authClient } from '../lib/auth-client';
import { extractPort } from '../lib/utils/extractPort';
import { inferContainerGroup } from '../lib/utils/inferContainerGroup';

interface HealthStatus {
  status: string;
  harness: string;
}

function ArchitecturePage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.logs.containers().then((r) => setContainers(r.containers)).catch(() => {}),
      api.models().then((r) => setModels(r.models)).catch(() => {}),
      api.health().then((r) => setHealth(r)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const gw = gatewayUrl();
  const grouped = groupContainers(containers);
  const harnessOk = health?.harness === 'ok';

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      {/* Page header — matches agents/enrichment pattern */}
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <h1 className="font-display text-2xl tracking-tightest">How it works</h1>
        </div>
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

      <main className="px-8 py-6 space-y-12">
        {/* Lede */}
        <p className="text-sm text-muted leading-relaxed max-w-2xl">
          The harness is a self-hosted AI orchestration stack.
          Your browser loads a static frontend, which calls a gateway API.
          The gateway authenticates you, then proxies requests to the harness —
          the core engine that manages models, agents, conversations, and
          enrichment pipelines. Everything runs in Docker on a shared network.
        </p>

        {/* The flow — typographic, not boxy */}
        <section>
          <h2 className="font-display text-xl mb-4">Request flow</h2>
          <div className="border-t border-border">
            <FlowRow
              n={1}
              from="Browser"
              to="Frontend"
              protocol="HTTPS"
              detail="Static React SPA served on port 3000. Reads the gateway URL from /config.js at runtime — nothing is baked into the bundle."
            />
            <FlowRow
              n={2}
              from="Frontend"
              to="Gateway"
              protocol="fetch / SSE"
              detail={`All API calls go to ${shortenUrl(gw)}. Session cookies handle auth. Streaming responses use EventSource with cursor-based reconnection.`}
            />
            <FlowRow
              n={3}
              from="Gateway"
              to="Harness"
              protocol="HTTP proxy"
              detail="The gateway forwards requests to mst-ag-harness:3800 over the Docker network. It also queries NocoDB for org data and reads the Docker socket for log streaming."
            />
            <FlowRow
              n={4}
              from="Harness"
              to="Models"
              protocol="Inference"
              detail={`The harness manages ${models.length || '—'} model endpoint${models.length !== 1 ? 's' : ''}. It orchestrates agents, handles context summarisation, runs enrichment pipelines, and streams structured output back.`}
            />
          </div>
        </section>

        {/* Streaming — the interesting bit */}
        <section>
          <h2 className="font-display text-xl mb-4">Streaming</h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl mb-4">
            Chat, code, and agent runs all use the same two-phase streaming pattern.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                <th className="text-left py-2 w-8">step</th>
                <th className="text-left py-2">what happens</th>
                <th className="text-left py-2">endpoint</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2.5 font-mono text-xs text-muted">1</td>
                <td className="py-2.5">
                  Browser <span className="font-mono text-xs">POST</span>s the
                  message. Gateway forwards to harness, which starts
                  a job and returns a <code className="font-mono text-xs">job_id</code>.
                </td>
                <td className="py-2.5 font-mono text-xs text-muted">/api/chat</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2.5 font-mono text-xs text-muted">2</td>
                <td className="py-2.5">
                  Browser opens an <span className="font-mono text-xs">EventSource</span> to
                  the gateway's stream relay. Gateway proxies SSE from the harness
                  without buffering.
                </td>
                <td className="py-2.5 font-mono text-xs text-muted">/api/stream/&#123;id&#125;</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2.5 font-mono text-xs text-muted">3</td>
                <td className="py-2.5">
                  Events stream back in real time —
                  {' '}<EventTag>chunk</EventTag>{' '}
                  <EventTag>meta</EventTag>{' '}
                  <EventTag>searching</EventTag>{' '}
                  <EventTag>parsed</EventTag>{' '}
                  <EventTag>done</EventTag>.
                  Each event carries an ID for cursor-based reconnection.
                </td>
                <td className="py-2.5 font-mono text-xs text-muted">SSE events</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Containers */}
        <section>
          <h2 className="font-display text-xl mb-4">Containers</h2>
          {containers.length === 0 ? (
            <div className="text-sm text-muted py-4">
              {loading ? 'Loading…' : 'No container data — is the Docker socket mounted?'}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted mb-2">
                    {group}
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                        <th className="text-left py-2 w-5" />
                        <th className="text-left py-2">name</th>
                        <th className="text-left py-2">image</th>
                        <th className="text-left py-2">status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <tr key={c.id} className="border-b border-border hover:bg-panelHi">
                          <td className="py-2">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${c.state === 'running' ? 'bg-fg' : 'bg-border'}`}
                            />
                          </td>
                          <td className="py-2 font-mono text-xs">{c.name}</td>
                          <td className="py-2 font-mono text-xs text-muted truncate max-w-[280px]">
                            {c.image}
                          </td>
                          <td className="py-2 text-xs text-muted">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Models */}
        {models.length > 0 && (
          <section>
            <h2 className="font-display text-xl mb-4">Models</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                  <th className="text-left py-2">name</th>
                  <th className="text-left py-2">role</th>
                  <th className="text-left py-2">endpoint</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.name} className="border-b border-border hover:bg-panelHi">
                    <td className="py-2 font-sans text-xs">{m.name}</td>
                    <td className="py-2 text-xs text-muted">{m.role ?? '—'}</td>
                    <td className="py-2 font-mono text-xs text-muted truncate max-w-[300px]">
                      {m.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Endpoints */}
        <section>
          <h2 className="font-display text-xl mb-4">Endpoints</h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl mb-4">
            All routes are prefixed with the gateway URL. Every endpoint except
            setup and health requires an authenticated session cookie.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                <th className="text-left py-2">route</th>
                <th className="text-left py-2">method</th>
                <th className="text-left py-2">purpose</th>
              </tr>
            </thead>
            <tbody>
              <EndpointRow path="/api/health" method="GET" purpose="Gateway + harness connectivity check" />
              <EndpointRow path="/api/models" method="GET" purpose="List available LLM models" />
              <EndpointRow path="/api/chat" method="POST" purpose="Start a chat stream job" />
              <EndpointRow path="/api/code" method="POST" purpose="Start a code stream job (plan / execute / debug)" />
              <EndpointRow path="/api/run/stream" method="POST" purpose="Start an agent run with streaming output" />
              <EndpointRow path="/api/stream/{id}" method="GET" purpose="SSE relay — proxies events from harness" />
              <EndpointRow path="/api/conversations" method="GET" purpose="List chat conversations" />
              <EndpointRow path="/api/agents" method="GET" purpose="List registered agents" />
              <EndpointRow path="/api/enrichment/sources" method="GET" purpose="List enrichment scrape targets" />
              <EndpointRow path="/api/logs/stream" method="GET" purpose="SSE stream of Docker container logs" />
              <EndpointRow path="/api/logs/containers" method="GET" purpose="List all Docker containers" />
              <EndpointRow path="/api/schedules" method="GET" purpose="List agent cron schedules" />
            </tbody>
          </table>
        </section>

        {/* Network */}
        <section>
          <h2 className="font-display text-xl mb-4">Network</h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl mb-4">
            All containers share the{' '}
            <code className="font-mono text-xs text-fg">mst-ag-01-network</code>{' '}
            bridge network. Internal traffic uses Docker DNS —
            e.g. the gateway reaches the harness at{' '}
            <code className="font-mono text-xs text-fg">http://mst-ag-harness:3800</code>.
            Only the frontend (3000) and gateway ({extractPort(gw)}) expose ports to the host.
          </p>
          {containers.length > 0 && (
            <div className="flex flex-wrap gap-x-1 gap-y-1">
              {containers.map((c) => (
                <span
                  key={c.id}
                  className={[
                    'font-mono text-[11px] px-2 py-0.5 border',
                    c.state === 'running'
                      ? 'border-fg/20 text-fg'
                      : 'border-border text-muted',
                  ].join(' ')}
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Gateway URL */}
        <section className="pb-4">
          <h2 className="font-display text-xl mb-4">Your gateway</h2>
          <div className="font-mono text-sm text-fg">{gw}</div>
          <div className="text-xs text-muted mt-1">
            Set via <code className="font-mono">GATEWAY_URL</code> env var on
            the gateway container, injected into the frontend
            via <code className="font-mono">/config.js</code> at startup.
          </div>
        </section>
      </main>
    </div>
  );
}

// -- Components ---------------------------------------------------------------

function FlowRow({
  n,
  from,
  to,
  protocol,
  detail,
}: {
  n: number;
  from: string;
  to: string;
  protocol: string;
  detail: string;
}) {
  return (
    <div className="border-b border-border py-4 grid grid-cols-[2rem_1fr] gap-x-4">
      <span className="font-mono text-xs text-muted tabular-nums pt-0.5">{n}</span>
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-sans font-medium">{from}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted">→</span>
          <span className="text-sm font-sans font-medium">{to}</span>
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] font-sans text-muted">
            {protocol}
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function EventTag({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] text-fg border border-border px-1 py-px">
      {children}
    </code>
  );
}

function EndpointRow({
  path,
  method,
  purpose,
}: {
  path: string;
  method: string;
  purpose: string;
}) {
  return (
    <tr className="border-b border-border hover:bg-panelHi">
      <td className="py-2 font-mono text-xs">{path}</td>
      <td className="py-2 text-[10px] uppercase tracking-[0.12em] font-sans text-muted">
        {method}
      </td>
      <td className="py-2 text-xs text-muted">{purpose}</td>
    </tr>
  );
}

// -- Helpers ------------------------------------------------------------------

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return `${u.hostname}:${port}`;
  } catch {
    return url;
  }
}

function groupContainers(
  containers: DockerContainer[],
): [string, DockerContainer[]][] {
  const groups = new Map<string, DockerContainer[]>();
  for (const c of containers) {
    const group = inferContainerGroup(c);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(c);
  }
  const order = ['Models', 'Services', 'Data', 'Proxy'];
  return [...groups.entries()].sort(
    (a, b) =>
      (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
      (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
  );
}

export const Route = createFileRoute('/architecture')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: ArchitecturePage,
});