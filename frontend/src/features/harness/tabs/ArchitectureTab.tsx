import { useEffect, useState } from 'react';
import type { DockerContainer } from '../../../api/types/DockerContainer';
import type { LlmModel } from '../../../api/types/LlmModel';
import { listLogContainers } from '../../../api/logs/listLogContainers';
import { listModels } from '../../../api/models/listModels';
import { gatewayUrl } from '../../../lib/runtime-env';
import { extractPort } from '../../../lib/utils/extractPort';
import { StackNode } from '../components/StackNode';
import { StackArrow } from '../components/StackArrow';
import { DetailPanel } from '../components/DetailPanel';
import { FlowStep } from '../components/FlowStep';
import { MODEL_ROLE_DESCRIPTIONS } from '../constants/MODEL_ROLE_DESCRIPTIONS';
import { matchDataInfo } from '../utils/matchDataInfo';

export function ArchitectureTab() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listLogContainers().then((r) => setContainers(r.containers)).catch(() => {}),
      listModels().then((r) => setModels(r.models)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const gw = gatewayUrl();

  const dataContainers = containers.filter((c) => {
    const n = c.name.toLowerCase();
    const img = c.image.toLowerCase();
    return (
      n.includes('redis') || n.includes('postgres') || n.includes('nocodb') ||
      n.includes('mysql') || n.includes('mongo') ||
      img.includes('redis') || img.includes('postgres') || img.includes('nocodb')
    );
  });

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  if (loading) {
    return <div className="px-8 py-6 text-sm text-muted">Loading stack info…</div>;
  }

  return (
    <div className="px-8 py-6 space-y-10">
      <section>
        <h2 className="font-display text-xl mb-2">How a prompt flows through the stack</h2>
        <p className="text-sm text-muted leading-relaxed max-w-2xl mb-6">
          Click any component to see what it does.
        </p>

        <div className="border border-border rounded-lg bg-panel/30 p-6 space-y-6">
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
