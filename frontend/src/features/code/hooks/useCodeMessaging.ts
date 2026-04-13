import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { CodeMessage } from '../types/CodeMessage';
import type { Mode } from '../types/Mode';
import type { AttachedFile } from '../types/AttachedFile';
import type { Codebase } from '../../../api/types/Codebase';
import type { CodeFilePayload } from '../../../api/types/CodeFilePayload';
import { codeStream } from '../../../api/code/codeStream';
import { getCodeMessages } from '../../../api/code/getCodeMessages';
import { uid } from '../../../lib/utils/uid';
import { labelForTool } from '../../../lib/intent/labelForTool';
import { isTransientNetworkError } from '../../../lib/network/isTransientNetworkError';
import { replayStream } from '../../../api/replayStream';
import { hydrateCodeMessages } from '../utils/hydrateCodeMessages';
import type { CodeConversation } from '../../../api/types/CodeConversation';

export interface CodeMessagingState {
  messages: CodeMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CodeMessage[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;

  copiedMessageId: string | null;
  setCopiedMessageId: React.Dispatch<React.SetStateAction<string | null>>;

  approvedPlan: string | null;
  setApprovedPlan: React.Dispatch<React.SetStateAction<string | null>>;

  streamAbortRef: React.MutableRefObject<AbortController | null>;
  retryTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

  send: (
    forcedText?: string,
    opts?: { overrideMode?: Mode; overrideApprovedPlan?: string | null },
  ) => Promise<void>;
  approvePlan: (m: CodeMessage) => void;
  sendStepPrompt: (stepIdx: number, step: string) => void;
  copyMessage: (m: CodeMessage) => Promise<void>;
  editUserMessage: (m: CodeMessage) => void;
  retryMessage: (m: CodeMessage) => void;
  applyAll: (blocks: any[]) => void;
  runSandbox: (code: string) => Promise<string>;
  scheduleCodeRetry: (convId: number, onRetry: () => Promise<void>) => void;
  resumeCodeStream: (
    c: CodeConversation,
    jobId: string,
    onMsgRes: (msgRes: any) => Promise<void>,
  ) => Promise<void>;
}

export function useCodeMessaging(
  model: string,
  mode: Mode,
  conversationId: number | null,
  files: AttachedFile[],
  ragEnabled: boolean,
  knowledgeEnabled: boolean,
  searchEnabled: boolean,
  searchSuppressed: boolean,
  useCodebase: boolean,
  codebaseCollection: string,
  styleKey: string,
  setMode: (m: Mode) => void,
  onRefreshSessions: () => Promise<void>,
  visIsHidden: () => boolean,
  visJustResumed: () => boolean,
  onRememberActiveSession: (id: number | null, jobId?: string) => void,
  onSetConversationId: (id: number | null) => void,
  onSetMode: (m: Mode) => void,
  checklist: string[],
  setChecklist: (items: string[]) => void,
  setChecked: (checked: Record<number, boolean>) => void,
): CodeMessagingState {
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [approvedPlan, setApprovedPlan] = useState<string | null>(null);

  const streamAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleCodeRetry(convId: number, onRetry: () => Promise<void>) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      try {
        await onRetry();
      } catch {}
    }, 4000);
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
          ...(searchSuppressed ? { search_enabled: false } : searchEnabled ? { search_enabled: true } : {}),
          codebase_collection:
            useCodebase && codebaseCollection ? codebaseCollection : undefined,
          response_style: styleKey || undefined,
        },
        controller.signal,
      );

      let gotConversationId = false;
      let streamJobId: string | null = null;
      if (conversationId != null) onRememberActiveSession(conversationId);
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
          if (ev.job_id) streamJobId = ev.job_id;
          if (ev.conversation_id && !gotConversationId) {
            onSetConversationId(ev.conversation_id);
            gotConversationId = true;
          }
          const cId = ev.conversation_id ?? conversationId;
          if (cId != null) {
            onRememberActiveSession(cId, streamJobId ?? undefined);
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
          onRememberActiveSession(null);
          if (ev.conversation_id && !gotConversationId) {
            onSetConversationId(ev.conversation_id);
            gotConversationId = true;
          }
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, status: 'complete', isThinking: false } : x)),
          );
        } else if (ev.type === 'error') {
          onRememberActiveSession(null);
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
      const transient = isTransientNetworkError(err) && (visIsHidden() || visJustResumed());
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
      await onRefreshSessions();
    }
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

  function applyAll(blocks: any[]) {
    // This will be implemented by the parent component using the file attachment hook
  }

  async function runSandbox(code: string): Promise<string> {
    const res = await fetch('/api/code/run', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return await res.text();
  }

  async function resumeCodeStream(
    c: CodeConversation,
    jobId: string,
    onMsgRes: (msgRes: any) => Promise<void>,
  ): Promise<void> {
    // Delegate message loading to parent component
    await onMsgRes({});
  }

  return {
    messages,
    setMessages,
    input,
    setInput,
    sending,
    setSending,
    error,
    setError,
    copiedMessageId,
    setCopiedMessageId,
    approvedPlan,
    setApprovedPlan,
    streamAbortRef,
    retryTimerRef,
    send,
    approvePlan,
    sendStepPrompt,
    copyMessage,
    editUserMessage,
    retryMessage,
    applyAll,
    runSandbox,
    scheduleCodeRetry,
    resumeCodeStream,
  };
}

