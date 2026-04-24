import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DockerContainer } from '../../api/types/DockerContainer';
import { listLogContainers } from '../../api/logs/listLogContainers';
import { inferContainerGroup } from '../../lib/utils/inferContainerGroup';
import { LogText } from './LogText';
import { useLogStream } from './hooks/useLogStream';
import { useAutoScroll } from './hooks/useAutoScroll';
import { containerColor } from './utils/containerColor';
import { classifyLevel } from './utils/classifyLevel';
import { formatTs } from './utils/formatTs';
import type { LogLevel } from './types/LogLevel';

export function LogsPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set());
  const [stderrOnly, setStderrOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { lines, connected, error, flushBuffer, clearLines } = useLogStream({ paused });
  const scrollRef = useAutoScroll(lines, paused);

  useEffect(() => {
    listLogContainers().then((r) => setContainers(r.containers)).catch(() => {});
  }, []);

  const unpause = useCallback(() => {
    setPaused(false);
    flushBuffer();
  }, [flushBuffer]);

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
      containers.filter((c) => inferContainerGroup(c) === group).map((c) => c.name),
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
      const group = inferContainerGroup(c);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(c);
    }
    const order = ['Models', 'Services', 'Data', 'Proxy'];
    return [...groups.entries()].sort(
      (a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
    );
  }, [containers, lines]);

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

  const Sidebar = (
    <>
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
    </>
  );

  return (
    <div className="h-full flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-bg border-r border-border flex flex-col overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-3 pt-3">
              <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted">Filters</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-muted hover:text-fg text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}

      <div className="hidden md:flex shrink-0 w-56 border-r border-border bg-panel/30 flex-col overflow-y-auto">
        {Sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="shrink-0 border-b border-border px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden px-2 py-0.5 rounded border border-border text-[10px] uppercase tracking-[0.1em] font-sans text-muted hover:text-fg"
            aria-label="Show container filters"
          >
            Filters
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-3 text-[11px] font-sans text-muted tabular-nums">
            <span>{lines.length.toLocaleString()} lines</span>
            {lineRate > 0 && <span>{lineRate}/s</span>}
            {counts.errors > 0 && <span className="text-red-400">{counts.errors} errors</span>}
            {counts.warns > 0 && <span className="text-amber-400">{counts.warns} warns</span>}
          </div>

          <div className="h-4 w-px bg-border" />

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

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="bg-transparent border border-border rounded px-2 py-0.5 text-[12px] font-mono w-32 sm:w-48 outline-none focus:border-fg placeholder:text-muted/40"
          />

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
