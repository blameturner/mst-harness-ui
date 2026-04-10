import { createFileRoute, redirect } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type DockerContainer, type LogLine } from '../lib/api';
import { authClient } from '../lib/auth-client';

const MAX_LINES = 2000;

// Stable hue per container name so colours don't shift between renders
const hueCache = new Map<string, number>();
function containerHue(name: string): number {
  let h = hueCache.get(name);
  if (h != null) return h;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  h = ((hash % 360) + 360) % 360;
  hueCache.set(name, h);
  return h;
}

function containerColor(name: string): string {
  return `hsl(${containerHue(name)}, 55%, 65%)`;
}

interface StoredLine extends LogLine {
  key: number;
}

function LogsPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const bufferRef = useRef<StoredLine[]>([]);
  const keyRef = useRef(0);
  const autoScrollRef = useRef(true);

  pausedRef.current = paused;

  useEffect(() => {
    api.logs.containers().then((r) => setContainers(r.containers)).catch(() => {});
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!autoScrollRef.current || paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, paused]);

  useEffect(() => {
    const url = api.logs.streamUrl({ since: 120, tail: 200 });
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    function connect() {
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => {
        failCount = 0;
        setConnected(true);
        setError(null);
      };

      es.onmessage = (ev) => {
        try {
          const parsed: LogLine = JSON.parse(ev.data);
          const stored: StoredLine = { ...parsed, key: keyRef.current++ };

          if (pausedRef.current) {
            bufferRef.current.push(stored);
            if (bufferRef.current.length > MAX_LINES) {
              bufferRef.current = bufferRef.current.slice(-MAX_LINES);
            }
            return;
          }

          setLines((prev) => {
            const next = [...prev, stored];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        failCount++;
        if (failCount >= 5) {
          setError('Cannot connect to log stream. Is the Docker socket mounted?');
          return;
        }
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const unpause = useCallback(() => {
    const buffered = bufferRef.current;
    bufferRef.current = [];
    setPaused(false);
    if (buffered.length > 0) {
      setLines((prev) => {
        const merged = [...prev, ...buffered];
        return merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged;
      });
    }
  }, []);

  const toggleContainer = useCallback((name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
    bufferRef.current = [];
  }, []);

  const visibleLines = useMemo(
    () => (hidden.size === 0 ? lines : lines.filter((l) => !hidden.has(l.container))),
    [lines, hidden],
  );

  const containerNames = useMemo(() => {
    const fromContainers = containers.map((c) => c.name);
    const fromLines = [...new Set(lines.map((l) => l.container))];
    return [...new Set([...fromContainers, ...fromLines])].sort();
  }, [containers, lines]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5 flex-wrap">
          {containerNames.map((name) => {
            const isHidden = hidden.has(name);
            const running = containers.find((c) => c.name === name)?.state === 'running';
            return (
              <button
                key={name}
                onClick={() => toggleContainer(name)}
                className={[
                  'px-2 py-0.5 rounded text-[11px] font-mono transition-all border',
                  isHidden
                    ? 'border-border text-muted opacity-50'
                    : 'border-transparent text-bg font-medium',
                ].join(' ')}
                style={
                  isHidden
                    ? undefined
                    : { backgroundColor: containerColor(name) }
                }
              >
                {name}
                {running === false && ' ■'}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => (paused ? unpause() : setPaused(true))}
            className={[
              'px-2.5 py-1 rounded text-[11px] font-sans uppercase tracking-[0.1em] transition-colors border',
              paused
                ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                : 'border-border text-muted hover:text-fg',
            ].join(' ')}
          >
            {paused ? `▶ Resume (${bufferRef.current.length})` : '⏸ Pause'}
          </button>
          <button
            onClick={clearLines}
            className="px-2.5 py-1 rounded text-[11px] font-sans uppercase tracking-[0.1em] text-muted hover:text-fg border border-border transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-500/10 text-red-500 text-xs font-sans">
          {error}
        </div>
      )}

      {/* Log output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[12.5px] leading-[1.65] bg-bg"
      >
        {visibleLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-sm font-sans">
            {connected ? 'Waiting for log output…' : 'Connecting…'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {visibleLines.map((line) => (
                <tr
                  key={line.key}
                  className={[
                    'group hover:bg-panelHi/40 align-top',
                    line.stderr ? 'text-red-400' : 'text-fg/85',
                  ].join(' ')}
                >
                  <td className="pl-3 pr-2 py-px whitespace-nowrap text-[10.5px] text-muted/60 select-none tabular-nums">
                    {formatTs(line.ts)}
                  </td>
                  <td
                    className="px-2 py-px whitespace-nowrap text-[11px] font-semibold select-none"
                    style={{ color: containerColor(line.container) }}
                  >
                    {line.container}
                  </td>
                  <td className="pr-3 py-px whitespace-pre-wrap break-all">
                    <LogText text={line.text} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatTs(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// Highlight common log patterns for readability
const LEVEL_RE = /\b(ERROR|FATAL|PANIC|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/;
const JSON_BRACE_RE = /^(\{.*\})$/;
const KEY_VALUE_RE = /(\w[\w.]*?)=((?:"[^"]*")|(?:\S+))/g;

function LogText({ text }: { text: string }) {
  const levelMatch = text.match(LEVEL_RE);
  if (!levelMatch) {
    return <span>{text}</span>;
  }

  const level = levelMatch[1];
  const levelIdx = levelMatch.index!;
  const before = text.slice(0, levelIdx);
  const after = text.slice(levelIdx + level.length);

  let levelClass = 'text-blue-400';
  if (level === 'ERROR' || level === 'FATAL' || level === 'PANIC') levelClass = 'text-red-400 font-semibold';
  else if (level === 'WARN' || level === 'WARNING') levelClass = 'text-amber-400';
  else if (level === 'DEBUG' || level === 'TRACE') levelClass = 'text-muted';

  return (
    <>
      {before && <span className="text-muted/70">{before}</span>}
      <span className={levelClass}>{level}</span>
      {after && <span>{after}</span>}
    </>
  );
}

export const Route = createFileRoute('/logs')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: LogsPage,
});
