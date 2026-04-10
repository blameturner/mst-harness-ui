import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  api,
  type CodeConversation,
  type CodeFilePayload,
  type CodeMessageRow,
  type LlmModel,
  type StyleSurface,
} from '../lib/api';
import { authClient } from '../lib/auth-client';
import { ComposerDock } from '../components/ComposerDock';
import { Sheet, IconButton } from '../components/Sheet';
import { styleLabel } from '../lib/styles';
import {
  isTransientNetworkError,
  useOnVisibilityResume,
  useWasRecentlyHidden,
} from '../lib/network';

type Mode = 'plan' | 'execute' | 'debug';

interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: Mode;
  content: string;
  status: 'complete' | 'streaming' | 'error';
  errorMessage?: string;
  responseStyle?: string | null;
  sourceUserText?: string;
  sourceMode?: Mode;
  sourceApprovedPlan?: string | null;
}

interface AttachedFile {
  name: string;
  content_b64: string;
  content?: string;
  size: number;
}

interface CodeBlock {
  lang: string;
  code: string;
  file?: string;
  index: number;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function parseCodeBlocks(md: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  const re = /```([\w+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(md)) !== null) {
    const lang = m[1] || 'text';
    let code = m[2];
    let file: string | undefined;
    const firstLine = code.split('\n', 1)[0] ?? '';
    const inline = firstLine.match(/^(?:\/\/|#)\s*file:\s*(.+?)\s*$/);
    if (inline) {
      file = inline[1];
      code = code.slice(firstLine.length + 1);
    } else {
      const before = md.slice(0, m.index).trimEnd();
      const lastNl = before.lastIndexOf('\n');
      const prevLine = (lastNl === -1 ? before : before.slice(lastNl + 1)).trim();
      const heading = prevLine.match(/^#{1,6}\s+([\w./\\-]+\.[\w]+)\s*$/);
      if (heading) file = heading[1];
    }
    out.push({ lang, code, file, index: i++ });
  }
  return out;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function downloadBlob(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DESTRUCTIVE_RE = /\b(rm\s+-rf|DROP\s+TABLE|DROP\s+DATABASE|curl\s+-X\s+DELETE|mkfs|sudo\s+rm)\b/i;

// Strips legacy wrappers from messages saved before the backend started storing clean user text
function cleanUserContent(s: string): string {
  return s.replace(/<attached_files>[\s\S]*?<\/attached_files>\n*/g, '').trim();
}

type DiffRow =
  | { kind: 'same'; left: string; right: string }
  | { kind: 'add'; right: string }
  | { kind: 'del'; left: string };

function computeDiff(before: string, after: string): DiffRow[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', left: a[i], right: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'del', left: a[i] });
      i++;
    } else {
      rows.push({ kind: 'add', right: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ kind: 'del', left: a[i++] });
  while (j < m) rows.push({ kind: 'add', right: b[j++] });
  return rows;
}

function DiffView({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => computeDiff(before, after), [before, after]);
  return (
    <div className="grid grid-cols-2 text-[11.5px] font-mono border-t border-border max-h-[420px] overflow-auto">
      <div className="border-r border-border">
        {rows.map((r, i) =>
          r.kind === 'same' ? (
            <div key={i} className="px-2 whitespace-pre">{r.left || ' '}</div>
          ) : r.kind === 'del' ? (
            <div key={i} className="px-2 whitespace-pre bg-red-500/15 text-red-600">- {r.left || ' '}</div>
          ) : (
            <div key={i} className="px-2 whitespace-pre">&nbsp;</div>
          ),
        )}
      </div>
      <div>
        {rows.map((r, i) =>
          r.kind === 'same' ? (
            <div key={i} className="px-2 whitespace-pre">{r.right || ' '}</div>
          ) : r.kind === 'add' ? (
            <div key={i} className="px-2 whitespace-pre bg-green-500/15 text-green-700">+ {r.right || ' '}</div>
          ) : (
            <div key={i} className="px-2 whitespace-pre">&nbsp;</div>
          ),
        )}
      </div>
    </div>
  );
}

import { highlightToTokens, type ShikiToken } from '../lib/shiki';

function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const [lines, setLines] = useState<ShikiToken[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    highlightToTokens(code, lang)
      .then((res) => {
        if (!cancelled) setLines(res.tokens);
      })
      .catch(() => {
        if (!cancelled) setLines(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!lines) {
    return (
      <pre className="font-mono text-[12px] leading-relaxed p-3 overflow-x-auto whitespace-pre bg-bg">
        <code>{code}</code>
      </pre>
    );
  }
  return (
    <pre className="font-mono text-[12px] leading-relaxed p-3 overflow-x-auto whitespace-pre bg-bg">
      <code>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line.length === 0 ? (
              '\n'
            ) : (
              <>
                {line.map((tok, j) => (
                  <span key={j} style={tok.color ? { color: tok.color } : undefined}>
                    {tok.content}
                  </span>
                ))}
                {i < lines.length - 1 ? '\n' : ''}
              </>
            )}
          </span>
        ))}
      </code>
    </pre>
  );
}

function CodeBlockCard({
  block,
  workspace,
}: {
  block: CodeBlock;
  workspace: AttachedFile[];
}) {
  const [showDiff, setShowDiff] = useState(true);
  const existing = block.file
    ? workspace.find((w) => w.name === block.file || w.name.endsWith('/' + block.file))
    : undefined;
  const existingText = existing?.content ?? (existing ? b64ToUtf8(existing.content_b64) : '');
  const saveName = block.file ?? `snippet.${block.lang === 'text' ? 'txt' : block.lang}`;
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-panel/60 border-b border-border text-[10px] uppercase tracking-[0.14em] font-sans text-muted flex items-center justify-between gap-2">
        <span className="truncate">
          {block.file ? (
            <>
              <span className="text-fg">{block.file}</span>
              <span className="ml-2">· {block.lang}</span>
            </>
          ) : (
            block.lang
          )}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {existing && (
            <button onClick={() => setShowDiff((d) => !d)} className="hover:text-fg">
              {showDiff ? 'Raw' : 'Diff'}
            </button>
          )}
          <button
            onClick={() => void navigator.clipboard.writeText(block.code)}
            className="hover:text-fg"
          >
            Copy
          </button>
          <button onClick={() => downloadBlob(saveName, block.code)} className="hover:text-fg">
            Save
          </button>
        </div>
      </div>
      {existing && showDiff ? (
        <DiffView before={existingText} after={block.code} />
      ) : (
        <ShikiBlock code={block.code} lang={block.lang} />
      )}
    </div>
  );
}

function CodePage() {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');
  const [mode, setMode] = useState<Mode>('plan');
  const [approvedPlan, setApprovedPlan] = useState<string | null>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [sessions, setSessions] = useState<CodeConversation[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [useCodebase, setUseCodebase] = useState(false);
  const [codebaseCollection, setCodebaseCollection] = useState('mst-harness');

  const [codeStyles, setCodeStyles] = useState<StyleSurface | null>(null);
  const [styleKey, setStyleKey] = useState<string>('');

  const [runOutput, setRunOutput] = useState<Record<string, string>>({});

  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);

  const streamAbortRef = useRef<AbortController | null>(null);
  const vis = useWasRecentlyHidden();
  const bootOkRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, stylesRes] = await Promise.all([
          api.models(),
          api.styles('code').catch(() => null),
        ]);
        if (cancelled) return;
        setModels(res.models);
        const coder = res.models.find((m) => m.role === 'coder');
        if (coder || res.models[0]) setModel((prev) => prev || coder?.name || res.models[0].name);
        if (stylesRes?.code) {
          setCodeStyles(stylesRes.code);
          setStyleKey((prev) => prev || stylesRes.code!.default);
        }
        bootOkRef.current = true;
      } catch (err) {
        if (cancelled) return;
        if (isTransientNetworkError(err)) return;
        setError((err as Error)?.message ?? 'Failed to load models');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useOnVisibilityResume(() => {
    if (!bootOkRef.current) {
      void (async () => {
        try {
          const [res, stylesRes] = await Promise.all([
            api.models(),
            api.styles('code').catch(() => null),
          ]);
          setModels(res.models);
          const coder = res.models.find((m) => m.role === 'coder');
          setModel((prev) => prev || coder?.name || res.models[0]?.name || '');
          if (stylesRes?.code) {
            setCodeStyles(stylesRes.code);
            setStyleKey((prev) => prev || stylesRes.code!.default);
          }
          bootOkRef.current = true;
          setError(null);
        } catch {}
      })();
    }
    void refreshSessions();
  });

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await api.code.conversations();
      setSessions(res.conversations ?? []);
    } catch (err) {
      console.error('[code] failed to load sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);


  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function selectSession(c: CodeConversation) {
    setConversationId(c.Id);
    setMessages([]);
    setFiles([]);
    setApprovedPlan(null);
    setChecklist([]);
    setChecked({});
    setError(null);
    if (c.mode) setMode(c.mode);
    if (c.model) setModel(c.model);
    try {
      const saved = window.localStorage.getItem(`codeStyle:${c.Id}`);
      if (saved) setStyleKey(saved);
      else if (codeStyles) setStyleKey(codeStyles.default);
    } catch {}
    try {
      const [{ messages: rows }, ws] = await Promise.all([
        api.code.messages(c.Id),
        api.code.workspace(c.Id),
      ]);
      const loaded: CodeMessage[] = rows.map((r: CodeMessageRow) => ({
        id: String(r.Id),
        role: r.role === 'assistant' ? 'assistant' : 'user',
        mode: (r.mode ?? 'plan') as Mode,
        content: r.role === 'user' ? cleanUserContent(r.content) : r.content,
        status: 'complete',
        responseStyle: r.response_style ?? null,
      }));
      setMessages(loaded);
      const hydrated: AttachedFile[] = (ws.files ?? []).map((f) => ({
        name: f.name,
        content: f.content,
        content_b64: utf8ToB64(f.content),
        size: f.content.length,
      }));
      setFiles(hydrated);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load session');
    }
  }

  function newSession() {
    setConversationId(null);
    setMessages([]);
    setFiles([]);
    setApprovedPlan(null);
    setChecklist([]);
    setChecked({});
    setError(null);
  }

  async function renameSession(c: CodeConversation) {
    const next = window.prompt('Rename session', c.title || '');
    if (!next || next === c.title) return;
    try {
      await api.code.rename(c.Id, next);
      await refreshSessions();
    } catch (err) {
      setError((err as Error)?.message ?? 'Rename failed');
    }
  }

  async function addFiles(picked: File[]) {
    const encoded: AttachedFile[] = [];
    for (const f of picked) {
      try {
        const b64 = await fileToBase64(f);
        encoded.push({
          name: f.name,
          content_b64: b64,
          content: b64ToUtf8(b64),
          size: f.size,
        });
      } catch (err) {
        console.error('[code] file encode failed', f.name, err);
      }
    }
    setFiles((prev) => [
      ...prev.filter((p) => !encoded.find((e) => e.name === p.name)),
      ...encoded,
    ]);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0) await addFiles(dropped);
  }

  function approvePlan(m: CodeMessage) {
    setApprovedPlan(m.content);
    setMode('execute');
    void send('Implement the approved plan.', {
      overrideMode: 'execute',
      overrideApprovedPlan: m.content,
    });
  }

  function sendStepPrompt(stepIdx: number, step: string) {
    setInput(`Focus only on step ${stepIdx + 1}: "${step}"`);
    setMode('execute');
  }

  async function send(
    forcedText?: string,
    opts?: { overrideMode?: Mode; overrideApprovedPlan?: string | null },
  ) {
    const text = (forcedText ?? input).trim();
    if (!text || sending || !model) return;
    const effectiveMode = opts?.overrideMode ?? mode;
    const effectiveApproved =
      opts?.overrideApprovedPlan !== undefined
        ? opts.overrideApprovedPlan
        : effectiveMode === 'execute'
          ? approvedPlan
          : null;

    const userMsg: CodeMessage = {
      id: uid(),
      role: 'user',
      mode: effectiveMode,
      content: text,
      status: 'complete',
    };
    const pendingId = uid();
    const pendingMsg: CodeMessage = {
      id: pendingId,
      role: 'assistant',
      mode: effectiveMode,
      content: '',
      status: 'streaming',
      responseStyle: styleKey || null,
      sourceUserText: text,
      sourceMode: effectiveMode,
      sourceApprovedPlan: effectiveApproved,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    if (!forcedText) setInput('');
    setSending(true);
    setError(null);
    setChecklist([]);
    setChecked({});

    const payloadFiles: CodeFilePayload[] = files.map((f) => ({
      name: f.name,
      content_b64: f.content_b64,
    }));
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const stream = api.codeStream(
        {
          model,
          message: text,
          mode: effectiveMode,
          approved_plan: effectiveApproved,
          files: payloadFiles.length > 0 ? payloadFiles : undefined,
          conversation_id: conversationId ?? undefined,
          codebase_collection:
            useCodebase && codebaseCollection ? codebaseCollection : undefined,
          response_style: styleKey || undefined,
        },
        controller.signal,
      );

      let gotConversationId = false;
      for await (const ev of stream) {
        if (ev.type === 'chunk') {
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, content: x.content + ev.text } : x)),
          );
        } else if (ev.type === 'meta') {
          if (ev.conversation_id && !gotConversationId) {
            setConversationId(ev.conversation_id);
            gotConversationId = true;
          }
        } else if (ev.type === 'plan_checklist') {
          setChecklist(ev.steps ?? []);
          setChecked({});
        } else if (ev.type === 'done') {
          if (ev.conversation_id && !gotConversationId) {
            setConversationId(ev.conversation_id);
            gotConversationId = true;
          }
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, status: 'complete' } : x)),
          );
        } else if (ev.type === 'error') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'error', errorMessage: ev.message }
                : x,
            ),
          );
          setError(ev.message);
          break;
        }
      }
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError';
      const transient =
        isTransientNetworkError(err) && (vis.isHidden() || vis.justResumed());
      if (!aborted && !transient) {
        const msg = (err as Error)?.message ?? 'Send failed';
        setMessages((ms) =>
          ms.map((x) =>
            x.id === pendingId ? { ...x, status: 'error', errorMessage: msg } : x,
          ),
        );
        setError(msg);
      } else if (transient) {
        setMessages((ms) => ms.filter((x) => x.id !== pendingId));
      }
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setSending(false);
      void refreshSessions();
    }
  }

  function retryMessage(m: CodeMessage) {
    if (!m.sourceUserText) return;
    setMessages((ms) => {
      const idx = ms.findIndex((x) => x.id === m.id);
      if (idx <= 0) return ms.filter((x) => x.id !== m.id);
      const prev = ms[idx - 1];
      const toDrop = new Set([m.id]);
      if (prev?.role === 'user') toDrop.add(prev.id);
      return ms.filter((x) => !toDrop.has(x.id));
    });
    void send(m.sourceUserText, {
      overrideMode: m.sourceMode,
      overrideApprovedPlan: m.sourceApprovedPlan,
    });
  }

  function applyAll(blocks: CodeBlock[]) {
    const targeted = blocks.filter((b) => b.file);
    if (targeted.length < 2) return;
    for (const b of targeted) downloadBlob(b.file!, b.code);
    const merged: AttachedFile[] = [
      ...files.filter((f) => !targeted.find((t) => t.file === f.name)),
      ...targeted.map((b) => ({
        name: b.file!,
        content: b.code,
        content_b64: utf8ToB64(b.code),
        size: b.code.length,
      })),
    ];
    setFiles(merged);
  }

  async function runSandbox(m: CodeMessage, code: string) {
    if (DESTRUCTIVE_RE.test(code)) {
      if (!window.confirm('This block looks destructive. Run anyway?')) return;
    }
    setRunOutput((o) => ({ ...o, [m.id]: 'Running…' }));
    try {
      const res = await fetch('/api/code/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const text = await res.text();
      setRunOutput((o) => ({ ...o, [m.id]: text || '(no output)' }));
    } catch (err) {
      setRunOutput((o) => ({
        ...o,
        [m.id]: `Run failed: ${(err as Error)?.message ?? 'unknown'}`,
      }));
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastBlocks = lastAssistant ? parseCodeBlocks(lastAssistant.content) : [];
  const fileTargeted = lastBlocks.filter((b) => b.file);

  const sidebarBody = (opts?: { onPick?: () => void }) => (
    <>
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code sessions</p>
        <button
          onClick={() => {
            newSession();
            opts?.onPick?.();
          }}
          className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-2 py-1 rounded hover:border-fg hover:text-fg"
        >
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {sessionsLoading ? (
          <p className="text-muted text-xs px-2 py-2">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted text-xs px-2 py-2">No sessions yet.</p>
        ) : (
          sessions.map((c) => {
            const active = c.Id === conversationId;
            return (
              <div
                key={c.Id}
                className={`group w-full text-left px-2 py-1.5 rounded border transition truncate ${
                  active
                    ? 'bg-panelHi border-fg'
                    : 'bg-panel border-border hover:border-fg/60'
                }`}
              >
                <button
                  onClick={() => {
                    void selectSession(c);
                    opts?.onPick?.();
                  }}
                  className="w-full text-left block"
                >
                  <div className="text-[13px] font-medium truncate">
                    {c.title || 'Untitled'}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-muted truncate flex items-center justify-between">
                    <span className="truncate">{c.model}</span>
                    <span className="ml-2 font-sans px-1 border border-border rounded">
                      {c.mode ?? 'plan'}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => void renameSession(c)}
                  className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                >
                  Rename
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="h-full flex bg-bg text-fg">
      {/* Sidebar (desktop column) */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border flex-col bg-panel/20">
        {sidebarBody()}
      </aside>

      {/* Sidebar (mobile sheet) */}
      <Sheet
        open={sessionsSheetOpen}
        side="left"
        onClose={() => setSessionsSheetOpen(false)}
        label="Code sessions"
      >
        {sidebarBody({ onPick: () => setSessionsSheetOpen(false) })}
      </Sheet>

      {/* Transcript column */}
      <div
        className="flex-1 flex flex-col border-r border-border min-w-0"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => void onDrop(e)}
      >
        <header className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <div className="md:hidden">
            <IconButton
              onClick={() => setSessionsSheetOpen(true)}
              label="Open sessions"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </IconButton>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code worker</p>
            <h2 className="font-display text-base sm:text-xl font-semibold tracking-tightest truncate">
              Plan / Run / Debug
            </h2>
          </div>
          <div className="xl:hidden shrink-0">
            <button
              type="button"
              onClick={() => setRailSheetOpen(true)}
              className="text-[11px] uppercase tracking-[0.14em] font-sans px-2 sm:px-3 py-1.5 rounded-md border border-border text-fg hover:bg-panelHi transition-colors"
              title="Show code output"
            >
              <span className="hidden sm:inline">Output</span>
              <span className="sm:hidden">
                {lastBlocks.length > 0 ? `Output · ${lastBlocks.length}` : 'Output'}
              </span>
            </button>
          </div>
        </header>

        {approvedPlan && (
          <div className="border-b border-border px-6 py-2 bg-panel/40 flex items-center justify-between">
            <span className="text-[11px] font-sans text-muted">
              Plan approved — injected on execute turns
            </span>
            <button
              onClick={() => setApprovedPlan(null)}
              className="text-[10px] uppercase tracking-[0.14em] text-fg hover:underline underline-offset-4"
            >
              Clear
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 ${
            dragOver ? 'bg-panelHi/30 outline outline-2 outline-fg/40' : ''
          }`}
        >
          {messages.length === 0 ? (
            <div className="pt-16 text-center">
              <p className="font-display text-3xl font-semibold tracking-tightest">
                Code with Jeff.
              </p>
              <p className="text-muted text-sm mt-3 font-sans">
                Plan first · approve · Knead
              </p>
              <p className="text-muted text-[11px] mt-6 font-sans">
                Drop files anywhere to attach.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const blocks = m.role === 'assistant' ? parseCodeBlocks(m.content) : [];
              const out = runOutput[m.id];
              return (
                <div
                  key={m.id}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={[
                      'max-w-[94%] md:max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed',
                      m.role === 'user'
                        ? 'bg-fg text-bg rounded-br-sm whitespace-pre-wrap'
                        : 'bg-panel border border-border text-fg rounded-bl-sm markdown-body',
                    ].join(' ')}
                  >
                    <div className="text-[9px] uppercase tracking-[0.16em] font-sans text-muted mb-1 flex items-center gap-2">
                      <span>{m.mode}</span>
                      {m.role === 'assistant' && m.responseStyle && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <span className="w-1 h-1 rounded-full bg-fg/50" />
                          {styleLabel(m.responseStyle)}
                        </span>
                      )}
                    </div>
                    {m.role === 'user' ? (
                      m.content
                    ) : m.status === 'error' ? (
                      <div className="text-red-600 font-sans text-[12px]">
                        <p className="break-words">
                          {m.errorMessage || 'Request failed'}
                        </p>
                        {m.sourceUserText && (
                          <button
                            type="button"
                            onClick={() => retryMessage(m)}
                            className="mt-2 text-[10px] uppercase tracking-[0.14em] font-sans border border-red-600/60 text-red-600 px-2.5 py-1 rounded hover:bg-red-600 hover:text-bg transition-colors"
                          >
                            ↻ Retry
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {m.mode === 'plan' && m.status === 'complete' && (
                            <button
                              onClick={() => approvePlan(m)}
                              className="text-[11px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors"
                            >
                              Approve &amp; execute
                            </button>
                          )}
                          {m.mode === 'execute' &&
                            m.status === 'complete' &&
                            blocks.length > 0 && (
                              <button
                                onClick={() => void runSandbox(m, blocks[0].code)}
                                className="text-[11px] uppercase tracking-[0.14em] font-sans border border-border px-3 py-1 rounded hover:border-fg hover:text-fg transition-colors"
                              >
                                Run in sandbox
                              </button>
                            )}
                        </div>
                        {out && (
                          <pre className="mt-3 font-mono text-[11.5px] bg-bg border border-border rounded p-2 whitespace-pre-wrap max-h-64 overflow-auto">
                            {out}
                          </pre>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-600 font-sans">{error}</p>
          </div>
        )}

        <ComposerDock
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          sending={sending}
          disabled={!model}
          placeholder={model ? `Describe the ${mode} task…` : 'Load a model to start'}
          models={models}
          model={model}
          onModelChange={setModel}
          styles={codeStyles?.styles}
          styleKey={styleKey}
          onStyleChange={(k) => {
            setStyleKey(k);
            if (conversationId != null) {
              try {
                window.localStorage.setItem(`codeStyle:${conversationId}`, k);
              } catch {}
            }
          }}
          toggles={[
            {
              key: 'codebase',
              label: useCodebase ? `Codebase · ${codebaseCollection}` : 'Codebase RAG',
              active: useCodebase,
              title: 'Inject codebase search results into each turn',
              onToggle: () => setUseCodebase((v) => !v),
            },
          ]}
          leftRailSlot={
            <div className="flex items-center border border-border rounded overflow-hidden text-[11px] font-sans bg-panel/60">
              {(['plan', 'execute', 'debug'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    mode === m ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          }
          onAttach={(picked) => void addFiles(picked)}
          attachmentPreview={
            files.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <span
                    key={f.name}
                    className="text-[11px] font-sans px-2 py-1 rounded border border-border bg-panel/60 flex items-center gap-2"
                  >
                    {f.name}
                    <span className="text-muted">({f.size}b)</span>
                    <button
                      onClick={() => removeFile(f.name)}
                      className="text-muted hover:text-fg"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null
          }
        />
      </div>

      {/* Right rail (desktop column, xl+) */}
      <div className="hidden xl:flex w-1/2 max-w-[720px] flex-col bg-panel/20">
        {renderRailBody()}
      </div>

      {/* Right rail (mobile + tablet sheet, <xl) */}
      <Sheet
        open={railSheetOpen}
        side="right"
        onClose={() => setRailSheetOpen(false)}
        widthClass="w-[94vw] max-w-[640px]"
        mobileOnlyClass="xl:hidden"
        label="Code output"
      >
        <div className="flex flex-col h-full bg-bg">{renderRailBody()}</div>
      </Sheet>
    </div>
  );

  function renderRailBody() {
    return (
      <>
        {checklist.length > 0 && (
          <div className="border-b border-border px-4 sm:px-6 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
              Plan checklist
            </p>
            <ul className="space-y-1">
              {checklist.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                    className="mt-1"
                  />
                  <button
                    onClick={() => sendStepPrompt(i, step)}
                    className="flex-1 text-left hover:underline underline-offset-2"
                  >
                    <span className="font-sans text-muted mr-1">{i + 1}.</span>
                    {step}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code output</p>
            <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
              {lastBlocks.length > 0
                ? `${lastBlocks.length} block${lastBlocks.length === 1 ? '' : 's'}`
                : 'No code yet'}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fileTargeted.length >= 2 && (
              <button
                onClick={() => applyAll(lastBlocks)}
                className="text-[11px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors"
              >
                Apply all ({fileTargeted.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setRailSheetOpen(false)}
              className="xl:hidden text-[11px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-border text-muted hover:border-fg hover:text-fg"
              aria-label="Close output"
            >
              ×
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 min-h-0">
          {lastBlocks.length === 0 ? (
            <p className="text-muted text-sm font-sans">
              Code blocks from the latest assistant message will appear here.
            </p>
          ) : (
            lastBlocks.map((b) => <CodeBlockCard key={b.index} block={b} workspace={files} />)
          )}
        </div>
      </>
    );
  }
}

export const Route = createFileRoute('/code')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CodePage,
});
