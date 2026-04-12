import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { flushSync } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Codebase } from '../../api/types/Codebase';
import type { CodeConversation } from '../../api/types/CodeConversation';
import type { CodeFilePayload } from '../../api/types/CodeFilePayload';
import type { CodeMessageRow } from '../../api/types/CodeMessageRow';
import type { LlmModel } from '../../api/types/LlmModel';
import type { StyleSurface } from '../../api/types/StyleSurface';
import { listModels } from '../../api/models/listModels';
import { listStyles } from '../../api/styles/listStyles';
import { listCodeConversations } from '../../api/code/listCodeConversations';
import { getCodeMessages } from '../../api/code/getCodeMessages';
import { getCodeWorkspace } from '../../api/code/getCodeWorkspace';
import { renameCodeConversation } from '../../api/code/renameCodeConversation';
import { codeStream } from '../../api/code/codeStream';
import { listCodebases } from '../../api/codebases/listCodebases';
import { ComposerDock } from '../../components/ComposerDock';
import { Sheet } from '../../components/Sheet';
import { IconButton } from '../../components/IconButton';
import { styleLabel } from '../../lib/styles/styleLabel';
import { isTransientNetworkError } from '../../lib/network/isTransientNetworkError';
import { useOnVisibilityResume } from '../../hooks/useOnVisibilityResume';
import { useWasRecentlyHidden } from '../../hooks/useWasRecentlyHidden';
import { uid } from '../../lib/utils/uid';
import { labelForTool } from '../../lib/intent/labelForTool';
import { formatBytes } from '../../lib/utils/formatBytes';
import { useAutoScrollToBottom } from '../chat/hooks/useAutoScrollToBottom';
import type { Mode } from './types/Mode';
import type { CodeMessage } from './types/CodeMessage';
import type { AttachedFile } from './types/AttachedFile';
import type { CodeBlock } from './types/CodeBlock';
import { parseCodeBlocks } from './utils/parseCodeBlocks';
import { fileToBase64 } from './utils/fileToBase64';
import { b64ToUtf8 } from './utils/b64ToUtf8';
import { utf8ToB64 } from './utils/utf8ToB64';
import { cleanUserContent } from './utils/cleanUserContent';
import { DESTRUCTIVE_RE } from './constants/DESTRUCTIVE_RE';
import { CodeBlockCard } from './CodeBlockCard';
import { CodebaseManager } from './CodebaseManager';
import { SidebarBody } from './SidebarBody';

const STARTER_PROMPTS: Record<Mode, string[]> = {
  plan: [
    'Outline a migration from Express to Fastify for this repo',
    'Plan adding JWT auth to the attached server.js',
    'Break down refactoring this file into pure functions',
  ],
  execute: [
    'Implement step 1 from the approved plan',
    'Write the tests for the happy path',
    'Apply the plan to server.js and show the full file',
  ],
  debug: [
    'The attached stack trace crashes on startup — find the cause',
    'Why is this query returning no rows?',
    'Explain what this function does line by line',
  ],
};

export function CodePage() {
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
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  // Persistence across tab navigation: when the user leaves and comes back,
  // we want an in-flight code session to auto-resume instead of showing the
  // default new-session view.
  const ACTIVE_CODE_SESSION_KEY = 'codeActiveSession';
  const autoResumeTriedRef = useRef(false);
  function rememberActiveSession(id: number | null) {
    try {
      if (id == null) window.localStorage.removeItem(ACTIVE_CODE_SESSION_KEY);
      else window.localStorage.setItem(ACTIVE_CODE_SESSION_KEY, String(id));
    } catch {}
  }

  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [ragEnabled, setRagEnabled] = useState(false);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);
  const [useCodebase, setUseCodebase] = useState(false);
  const [codebaseCollection, setCodebaseCollection] = useState('');
  const [codebases, setCodebases] = useState<Codebase[]>([]);

  const [codeStyles, setCodeStyles] = useState<StyleSurface | null>(null);
  const [styleKey, setStyleKey] = useState<string>('');

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);

  const streamAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleCodeRetry(convId: number) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      if (conversationIdRef.current !== convId) return;
      try {
        const res = await getCodeMessages(convId);
        if (conversationIdRef.current !== convId) return;
        if (res.conversation?.status === 'processing') {
          // Connected successfully — drop reconnecting so the UI shows
          // a thinking indicator instead of the stale reconnecting badge.
          setMessages((ms) =>
            ms.map((x) =>
              x.id === `pending-${convId}` ? { ...x, reconnecting: false } : x,
            ),
          );
          scheduleCodeRetry(convId);
        } else {
          setMessages(hydrateCodeMessages(res.messages));
        }
      } catch {}
    }, 4000);
  }
  const vis = useWasRecentlyHidden();
  const bootOkRef = useRef(false);
  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScrollToBottom(messages);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, stylesRes, codebasesRes] = await Promise.all([
          listModels(),
          listStyles('code').catch(() => null),
          listCodebases().catch(() => ({ codebases: [] })),
        ]);
        if (cancelled) return;
        setModels(res.models);
        setCodebases(codebasesRes.codebases);
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
      streamAbortRef.current?.abort();
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, []);

  useOnVisibilityResume(() => {
    if (!bootOkRef.current) {
      void (async () => {
        try {
          const [res, stylesRes] = await Promise.all([
            listModels(),
            listStyles('code').catch(() => null),
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
      const res = await listCodeConversations();
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

  // Auto-resume in-flight session after tab navigation or reload.
  // Runs once after the sessions list first populates: if localStorage
  // remembers a session id and that session is still processing, call
  // selectSession so scheduleCodeRetry takes over polling until completion.
  useEffect(() => {
    if (autoResumeTriedRef.current) return;
    if (sessionsLoading) return;
    if (sessions.length === 0) return;
    autoResumeTriedRef.current = true;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(ACTIVE_CODE_SESSION_KEY);
    } catch {
      return;
    }
    if (!saved) return;
    const id = parseInt(saved, 10);
    if (!Number.isFinite(id)) {
      rememberActiveSession(null);
      return;
    }
    const c = sessions.find((s) => s.Id === id);
    if (!c) {
      rememberActiveSession(null);
      return;
    }
    void selectSession(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sessionsLoading]);


  function hydrateCodeMessages(rows: CodeMessageRow[]): CodeMessage[] {
    return rows.filter((r) => r.role !== 'system').map((r) => ({
      id: String(r.Id),
      role: r.role === 'assistant' ? 'assistant' as const : 'user' as const,
      mode: (r.mode ?? 'plan') as Mode,
      content: r.role === 'user' ? cleanUserContent(r.content) : r.content,
      status: 'complete' as const,
      responseStyle: r.response_style ?? null,
    }));
  }

  async function selectSession(c: CodeConversation) {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setConversationId(c.Id);
    rememberActiveSession(c.Id);
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
      const [msgRes, ws] = await Promise.all([
        getCodeMessages(c.Id),
        getCodeWorkspace(c.Id),
      ]);
      const loaded = hydrateCodeMessages(msgRes.messages);
      const convStatus = msgRes.conversation?.status;

      if (convStatus === 'processing') {
        setMessages([...loaded, {
          id: `pending-${c.Id}`,
          role: 'assistant',
          mode: c.mode ?? 'plan',
          content: '',
          status: 'streaming',
          reconnecting: true,
        }]);
        scheduleCodeRetry(c.Id);
      } else if (convStatus === 'error') {
        setMessages(loaded);
        setError('The model encountered an error processing this session.');
      } else {
        setMessages(loaded);
      }

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
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    rememberActiveSession(null);
    setConversationId(null);
    setMessages([]);
    setFiles([]);
    setApprovedPlan(null);
    setChecklist([]);
    setChecked({});
    setError(null);
    setRagEnabled(false);
    setKnowledgeEnabled(false);
    setMode('plan');
  }

  async function renameSession(c: CodeConversation, nextTitle: string) {
    try {
      await renameCodeConversation(c.Id, nextTitle);
      setSessions((prev) =>
        prev.map((s) => (s.Id === c.Id ? { ...s, title: nextTitle } : s)),
      );
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
    // checklist only resets when a new plan_checklist event arrives — keeps
    // user-ticked boxes intact across follow-up turns

    const payloadFiles: CodeFilePayload[] = files.map((f) => ({
      name: f.name,
      content_b64: f.content_b64,
    }));
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const isFirstMessage = conversationId == null;
      const stream = codeStream(
        {
          model,
          message: text,
          mode: effectiveMode,
          approved_plan: effectiveApproved,
          files: payloadFiles.length > 0 ? payloadFiles : undefined,
          conversation_id: conversationId ?? undefined,
          ...(isFirstMessage && ragEnabled ? { rag_enabled: true } : {}),
          ...(isFirstMessage && knowledgeEnabled ? { knowledge_enabled: true } : {}),
          codebase_collection:
            useCodebase && codebaseCollection ? codebaseCollection : undefined,
          response_style: styleKey || undefined,
        },
        controller.signal,
      );

      let gotConversationId = false;
      // If we already have a conversationId (continuing an existing session),
      // remember it before streaming starts so a tab-nav leave-return resumes
      // this session without waiting for the first meta event.
      if (conversationId != null) rememberActiveSession(conversationId);
      for await (const ev of stream) {
        if (ev.type === 'chunk') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    content: x.content + ev.text,
                    ...(x.isThinking
                      ? { isThinking: false, thinkingEndTime: Date.now() }
                      : {}),
                  }
                : x,
            ),
          );
        } else if (ev.type === 'tool_status') {
          const label =
            ev.phase === 'planning'
              ? ev.summary || 'Planning tools…'
              : ev.phase === 'start'
              ? `${labelForTool(ev.tool)}…`
              : undefined;
          flushSync(() => {
            setMessages((ms) =>
              ms.map((x) => (x.id === pendingId ? { ...x, toolStatus: label } : x)),
            );
          });
        } else if (ev.type === 'meta') {
          if (ev.conversation_id && !gotConversationId) {
            setConversationId(ev.conversation_id);
            rememberActiveSession(ev.conversation_id);
            gotConversationId = true;
          }
        } else if (ev.type === 'plan_checklist') {
          setChecklist(ev.steps ?? []);
          setChecked({});
        } else if (ev.type === 'thinking') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    thinkingContent: (x.thinkingContent ?? '') + ev.text,
                    thinkingStartTime: x.thinkingStartTime ?? Date.now(),
                    isThinking: true,
                  }
                : x,
            ),
          );
        } else if (ev.type === 'done') {
          if (ev.conversation_id && !gotConversationId) {
            setConversationId(ev.conversation_id);
            rememberActiveSession(ev.conversation_id);
            gotConversationId = true;
          }
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, status: 'complete', isThinking: false } : x)),
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

  async function copyMessage(m: CodeMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedMessageId(m.id);
      setTimeout(() => setCopiedMessageId((cur) => (cur === m.id ? null : cur)), 1400);
    } catch {}
  }

  function editUserMessage(m: CodeMessage) {
    if (m.role !== 'user') return;
    setMessages((ms) => {
      const idx = ms.findIndex((x) => x.id === m.id);
      if (idx < 0) return ms;
      const toDrop = new Set([m.id]);
      const next = ms[idx + 1];
      if (next && next.role === 'assistant') toDrop.add(next.id);
      return ms.filter((x) => !toDrop.has(x.id));
    });
    setInput(m.content);
    if (m.mode) setMode(m.mode);
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

  async function runSandbox(code: string): Promise<string> {
    if (DESTRUCTIVE_RE.test(code)) {
      if (!window.confirm('This block looks destructive. Run anyway?')) {
        throw new Error('cancelled');
      }
    }
    const res = await fetch('/api/code/run', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return await res.text();
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastBlocks = lastAssistant ? parseCodeBlocks(lastAssistant.content) : [];
  const fileTargeted = lastBlocks.filter((b) => b.file);

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
            lastBlocks.map((b) => (
              <CodeBlockCard
                key={b.index}
                block={b}
                workspace={files}
                onRun={(code) => runSandbox(code)}
              />
            ))
          )}
        </div>
        <CodebaseManager codebases={codebases} onUpdate={(cbs) => setCodebases(cbs)} />
      </>
    );
  }

  return (
    <div className="h-full flex bg-bg text-fg">
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border flex-col bg-panel/20">
        <SidebarBody
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          conversationId={conversationId}
          onNewSession={newSession}
          onSelectSession={(c) => void selectSession(c)}
          onRenameSession={(c, next) => renameSession(c, next)}
        />
      </aside>

      <Sheet
        open={sessionsSheetOpen}
        side="left"
        onClose={() => setSessionsSheetOpen(false)}
        label="Code sessions"
      >
        <SidebarBody
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          conversationId={conversationId}
          onNewSession={newSession}
          onSelectSession={(c) => void selectSession(c)}
          onRenameSession={(c, next) => renameSession(c, next)}
          onPick={() => setSessionsSheetOpen(false)}
        />
      </Sheet>

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
          <details className="border-b border-border bg-panel/40 group">
            <summary className="px-3 sm:px-6 py-2 flex items-center justify-between gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] font-sans text-muted min-w-0 truncate flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-fg shrink-0">Plan ✓</span>
                <span className="truncate">
                  {approvedPlan.split('\n').find((l) => l.trim()) ?? 'approved plan active'}
                </span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setApprovedPlan(null);
                  }}
                  className="text-[10px] uppercase tracking-[0.14em] text-fg hover:underline underline-offset-4"
                >
                  Clear
                </button>
              </span>
            </summary>
            <div className="px-3 sm:px-6 pb-3 pt-1">
              <pre className="text-[11.5px] font-sans text-fg whitespace-pre-wrap max-h-60 overflow-auto border border-border rounded bg-bg p-3">
                {approvedPlan}
              </pre>
              <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mt-2">
                Injected on every execute turn
              </p>
            </div>
          </details>
        )}

        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 ${
            dragOver ? 'bg-panelHi/30 outline outline-2 outline-fg/40' : ''
          }`}
        >
          {messages.length === 0 ? (
            <div className="pt-12 md:pt-16 text-center px-2">
              <p className="font-display text-3xl font-semibold tracking-tightest">
                Code with Jeff.
              </p>
              <p className="text-muted text-sm mt-3 font-sans">
                Plan first · approve · Knead
              </p>
              {model && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS[mode].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setInput(p)}
                      className="text-[12px] sm:text-[13px] font-sans px-3 py-1.5 rounded-full border border-border text-muted bg-panel/40 hover:border-fg hover:text-fg transition-colors max-w-full text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-muted text-[11px] mt-8 font-sans">
                Drop files anywhere to attach.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const blocks = m.role === 'assistant' ? parseCodeBlocks(m.content) : [];
              return (
                <div
                  key={m.id}
                  className={`group ${m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
                >
                  <div className="flex flex-col min-w-0 max-w-[94%] md:max-w-[85%] items-stretch">
                    <div
                      className={[
                        'px-4 py-3 rounded-2xl text-[14px] leading-relaxed',
                        m.role === 'user'
                          ? 'bg-fg text-bg rounded-br-sm whitespace-pre-wrap self-end'
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
                          {m.thinkingContent && (
                            <details
                              open={m.isThinking}
                              className="mb-2 group/think"
                            >
                              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 text-[11px] font-sans text-muted select-none">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="transition-transform group-open/think:rotate-90"
                                >
                                  <polyline points="9 6 15 12 9 18" />
                                </svg>
                                {m.isThinking ? (
                                  <span className="animate-pulse">Thinking…</span>
                                ) : (
                                  <span>
                                    Thought for{' '}
                                    {Math.round(
                                      ((m.thinkingEndTime ?? Date.now()) -
                                        (m.thinkingStartTime ?? Date.now())) /
                                        1000,
                                    )}
                                    s
                                  </span>
                                )}
                              </summary>
                              <pre className="mt-1.5 text-[11px] font-mono text-muted bg-bg/60 rounded-md p-3 whitespace-pre-wrap max-h-60 overflow-y-auto border border-border">
                                {m.thinkingContent}
                              </pre>
                            </details>
                          )}
                          {m.status === 'streaming' && m.toolStatus && (
                            <div className="text-[11px] italic text-muted mb-2 font-sans">
                              {m.toolStatus}
                              {m.reconnecting && (
                                <span className="ml-2 not-italic uppercase tracking-[0.14em] text-muted/80">
                                  · reconnecting
                                </span>
                              )}
                            </div>
                          )}
                          {m.status === 'streaming' && !m.content && !m.toolStatus && !m.isThinking && !m.thinkingContent && (
                            <div className="text-[11px] italic text-muted mb-2 font-sans">
                              {m.reconnecting ? 'Reconnecting…' : 'Thinking…'}
                            </div>
                          )}
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
                          </div>
                        </>
                      )}
                    </div>
                    {m.role === 'user' && !sending && (
                      <button
                        type="button"
                        onClick={() => editUserMessage(m)}
                        className="self-end mt-1 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        ✎ Edit
                      </button>
                    )}
                    {m.role === 'assistant' && m.status === 'complete' && m.content && (
                      <button
                        type="button"
                        onClick={() => void copyMessage(m)}
                        className="self-start mt-1 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity"
                      >
                        {copiedMessageId === m.id ? '✓ Copied' : '⧉ Copy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isAtBottom && messages.length > 0 && (
          <div className="px-3 sm:px-6 pb-2 pointer-events-none">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="pointer-events-auto text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-full border border-border bg-panel/90 backdrop-blur text-fg hover:bg-panelHi transition-colors flex items-center gap-1.5 shadow-card"
                aria-label="Jump to latest"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Jump to latest
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 sm:px-6 pb-2">
            <p className="text-xs text-red-600 font-sans">{error}</p>
          </div>
        )}

        {useCodebase && codebases.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-panel/30 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted shrink-0">Codebase</span>
            <select
              value={codebaseCollection}
              onChange={(e) => setCodebaseCollection(e.target.value)}
              className="bg-transparent border border-border rounded px-2 py-1 text-[12px] font-mono outline-none focus:border-fg text-fg"
            >
              <option value="">Select a codebase…</option>
              {codebases.map((cb) => (
                <option key={cb.id} value={cb.collection_name}>
                  {cb.name} ({cb.records} records)
                </option>
              ))}
            </select>
          </div>
        )}
        {useCodebase && codebases.length === 0 && (
          <div className="px-4 py-2 border-t border-border bg-panel/30 text-[11px] font-sans text-muted">
            No codebases indexed yet. Create one from the code page settings.
          </div>
        )}

        <ComposerDock
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          onStop={() => {
            streamAbortRef.current?.abort();
          }}
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
              key: 'memory',
              label: 'Memory',
              active: ragEnabled,
              disabled: conversationId != null,
              title: 'Per-conversation recall (first turn only)',
              onToggle: () => setRagEnabled((v) => !v),
            },
            {
              key: 'knowledge',
              label: 'Knowledge',
              active: knowledgeEnabled,
              disabled: conversationId != null,
              title: 'Graph extraction + shared knowledge (first turn only)',
              onToggle: () => setKnowledgeEnabled((v) => !v),
            },
            {
              key: 'codebase',
              label: useCodebase && codebaseCollection ? `Codebase · ${codebaseCollection}` : 'Codebase',
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
                    <span className="text-muted">{formatBytes(f.size)}</span>
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

      <div className="hidden xl:flex w-2/5 max-w-[640px] flex-col bg-panel/20">
        {renderRailBody()}
      </div>

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
}
