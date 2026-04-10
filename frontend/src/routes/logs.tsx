import { createFileRoute, redirect } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type DockerContainer, type LogLine } from '../lib/api';
import { authClient } from '../lib/auth-client';

const MAX_LINES = 2000;

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

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'other';

function classifyLevel(text: string): LogLevel {
  const m = text.match(/\b(ERROR|FATAL|PANIC|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/);
  if (!m) return 'other';
  const l = m[1];
  if (l === 'ERROR' || l === 'FATAL' || l === 'PANIC') return 'error';
  if (l === 'WARN' || l === 'WARNING') return 'warn';
  if (l === 'INFO') return 'info';
  return 'debug';
}

// Infer a group from the container name/image
function inferGroup(c: DockerContainer): string {
  const name = c.name.toLowerCase();
  const image = c.image.toLowerCase();
  if (name.includes('llama') || name.includes('model') || name.includes('reasoner') || name.includes('coder') || name.includes('fast') || image.includes('llama') || image.includes('gguf') || image.includes('vllm')) return 'Models';
  if (name.includes('redis') || name.includes('postgres') || name.includes('nocodb') || name.includes('mysql') || name.includes('mongo') || image.includes('redis') || image.includes('postgres') || image.includes('nocodb')) return 'Data';
  if (name.includes('nginx') || name.includes('proxy') || name.includes('traefik') || name.includes('caddy') || image.includes('nginx') || image.includes('proxy')) return 'Proxy';
  return 'Services';
}

/** Exported so the harness page can embed it inline */
export function LogsPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set());
  const [stderrOnly, setStderrOnly] = useState(false);

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

  const showAll = useCallback(() => setHidden(new Set()), []);

  const hideAll = useCallback(() => {
    const allNames = new Set(containers.map((c) => c.name));
    lines.forEach((l) => allNames.add(l.container));
    setHidden(allNames);
  }, [containers, lines]);

  const showGroup = useCallback((group: string) => {
    const groupNames = new Set(
      containers.filter((c) => inferGroup(c) === group).map((c) => c.name),
    );
    setHidden((prev) => {
      const next = new Set(prev);
      const allVisible = [...groupNames].every((n) => !next.has(n));
      if (allVisible) {
        groupNames.forEach((n) => next.add(n));
      } else {
        groupNames.forEach((n) => next.delete(n));
      }
      return next;
    });
  }, [containers]);

  const clearFilters = useCallback(() => {
    setHidden(new Set());
    setSearch('');
    setLevelFilter(new Set());
    setStderrOnly(false);
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
    bufferRef.current = [];
  }, []);

  const toggleLevel = useCallback((level: LogLevel) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const hasAnyFilter = hidden.size > 0 || search !== '' || levelFilter.size > 0 || stderrOnly;

  const visibleLines = useMemo(() => {
    let filtered = lines;
    if (hidden.size > 0) filtered = filtered.filter((l) => !hidden.has(l.container));
    if (stderrOnly) filtered = filtered.filter((l) => l.stderr);
    if (levelFilter.size > 0) filtered = filtered.filter((l) => levelFilter.has(classifyLevel(l.text)));
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter((l) => l.text.toLowerCase().includes(lower) || l.container.toLowerCase().includes(lower));
    }
    return filtered;
  }, [lines, hidden, search, levelFilter, stderrOnly]);

  // Group containers for the sidebar
  const groupedContainers = useMemo(() => {
    const groups = new Map<string, DockerContainer[]>();
    const allNames = new Set(containers.map((c) => c.name));
    lines.forEach((l) => {
      if (!allNames.has(l.container)) {
        allNames.add(l.container);
        containers.push({ id: l.id, name: l.container, image: '', state: 'running', status: '' });
      }
    });
    for (const c of containers) {
      const group = inferGroup(c);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(c);
    }
    // Sort groups in a stable order
    const order = ['Models', 'Services', 'Data', 'Proxy'];
    return [...groups.entries()].sort(
      (a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
    );
  }, [containers, lines]);

  // Line rate (lines/sec over last 5 seconds)
  const lineRate = useMemo(() => {
    if (lines.length < 2) return 0;
    const now = Date.now();
    const recent = lines.filter((l) => {
      try {
        return now - new Date(l.ts).getTime() < 5000;
      } catch {
        return false;
      }
    });
    return Math.round(recent.length / 5);
  }, [lines]);

  // Error/warn counts
  const counts = useMemo(() => {
    let errors = 0;
    let warns = 0;
    for (const l of lines) {
      const level = classifyLevel(l.text);
      if (level === 'error') errors++;
      else if (level === 'warn') warns++;
    }
    return { errors, warns };
  }, [lines]);

  return (
    <div className="h-full flex">
      {/* Sidebar — container filters */}
      <div className="shrink-0 w-56 border-r border-border bg-panel/30 flex flex-col overflow-y-auto">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted">Containers</span>
            <div className="flex gap-1">
              <button onClick={showAll} className="text-[9px] uppercase tracking-[0.1em] font-sans text-muted hover:text-fg px-1">All</button>
              <button onClick={hideAll} className="text-[9px] uppercase tracking-[0.1em] font-sans text-muted hover:text-fg px-1">None</button>
            </div>
          </div>
        </div>

        {groupedContainers.map(([group, items]) => (
          <div key={group} className="mb-2">
            <button
              onClick={() => showGroup(group)}
              className="w-full px-3 py-1 text-left text-[9px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg hover:bg-panelHi/40 transition-colors flex items-center justify-between"
            >
              <span>{group}</span>
              <span className="text-[9px] tabular-nums">
                {items.filter((c) => !hidden.has(c.name)).length}/{items.length}
              </span>
            </button>
            {items.map((c) => {
              const isHidden = hidden.has(c.name);
              const running = c.state === 'running';
              return (
                <button
                  key={c.name}
                  onClick={() => toggleContainer(c.name)}
                  className={[
                    'w-full px-3 py-1 text-left text-[11px] font-mono flex items-center gap-2 transition-all hover:bg-panelHi/40',
                    isHidden ? 'text-muted/40' : 'text-fg',
                  ].join(' ')}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: isHidden ? 'transparent' : containerColor(c.name),
                      border: isHidden ? '1px solid currentColor' : 'none',
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                  {!running && <span className="text-[9px] text-muted ml-auto shrink-0">stopped</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 border-b border-border px-4 py-2 flex items-center gap-3 flex-wrap">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Stats */}
          <div className="flex items-center gap-3 text-[11px] font-sans text-muted tabular-nums">
            <span>{lines.length.toLocaleString()} lines</span>
            {lineRate > 0 && <span>{lineRate}/s</span>}
            {counts.errors > 0 && <span className="text-red-400">{counts.errors} errors</span>}
            {counts.warns > 0 && <span className="text-amber-400">{counts.warns} warns</span>}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Level filters */}
          <div className="flex items-center gap-1">
            {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map((level) => {
              const active = levelFilter.has(level);
              const colors: Record<LogLevel, string> = {
                error: 'text-red-400 border-red-400/40 bg-red-400/10',
                warn: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
                info: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
                debug: 'text-muted border-border bg-panelHi/40',
                other: '',
              };
              return (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={[
                    'px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.08em] font-sans border transition-all',
                    active ? colors[level] : 'border-transparent text-muted/50 hover:text-muted',
                  ].join(' ')}
                >
                  {level}
                </button>
              );
            })}
            <button
              onClick={() => setStderrOnly((v) => !v)}
              className={[
                'px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.08em] font-sans border transition-all',
                stderrOnly ? 'text-red-400 border-red-400/40 bg-red-400/10' : 'border-transparent text-muted/50 hover:text-muted',
              ].join(' ')}
            >
              stderr
            </button>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="bg-transparent border border-border rounded px-2 py-0.5 text-[12px] font-mono w-48 outline-none focus:border-fg placeholder:text-muted/40"
          />

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            {hasAnyFilter && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1 rounded text-[11px] font-sans uppercase tracking-[0.1em] text-muted hover:text-fg border border-border transition-colors"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => (paused ? unpause() : setPaused(true))}
              className={[
                'px-2.5 py-1 rounded text-[11px] font-sans uppercase tracking-[0.1em] transition-colors border',
                paused
                  ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                  : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {paused ? 'Resume' : 'Pause'}
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
              {connected
                ? hasAnyFilter
                  ? 'No lines match current filters'
                  : 'Waiting for log output…'
                : 'Connecting…'}
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
                      <LogText text={line.text} highlight={search} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

const LEVEL_RE = /\b(ERROR|FATAL|PANIC|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/;

function LogText({ text, highlight }: { text: string; highlight: string }) {
  const levelMatch = text.match(LEVEL_RE);

  let levelClass = '';
  let level = '';
  let levelIdx = -1;

  if (levelMatch) {
    level = levelMatch[1];
    levelIdx = levelMatch.index!;
    if (level === 'ERROR' || level === 'FATAL' || level === 'PANIC') levelClass = 'text-red-400 font-semibold';
    else if (level === 'WARN' || level === 'WARNING') levelClass = 'text-amber-400';
    else if (level === 'INFO') levelClass = 'text-blue-400';
    else if (level === 'DEBUG' || level === 'TRACE') levelClass = 'text-muted';
  }

  if (!highlight && !levelMatch) return <span>{text}</span>;

  // Build segments: level highlight + search highlight
  const parts: Array<{ text: string; className?: string }> = [];
  if (levelMatch) {
    if (levelIdx > 0) parts.push({ text: text.slice(0, levelIdx), className: 'text-muted/70' });
    parts.push({ text: level, className: levelClass });
    if (levelIdx + level.length < text.length) parts.push({ text: text.slice(levelIdx + level.length) });
  } else {
    parts.push({ text });
  }

  if (!highlight) {
    return (
      <>
        {parts.map((p, i) => (
          <span key={i} className={p.className}>{p.text}</span>
        ))}
      </>
    );
  }

  // Apply search highlight within each part
  const lower = highlight.toLowerCase();
  return (
    <>
      {parts.map((p, i) => {
        const idx = p.text.toLowerCase().indexOf(lower);
        if (idx === -1) return <span key={i} className={p.className}>{p.text}</span>;
        return (
          <span key={i} className={p.className}>
            {p.text.slice(0, idx)}
            <mark className="bg-amber-300/40 text-inherit rounded-sm px-px">{p.text.slice(idx, idx + highlight.length)}</mark>
            {p.text.slice(idx + highlight.length)}
          </span>
        );
      })}
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
