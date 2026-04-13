import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ChatMessageRow } from '../../api/types/ChatMessageRow';
import type { Conversation } from '../../api/types/Conversation';
import type { ConversationSummary } from '../../api/types/ConversationSummary';
import type { LlmModel } from '../../api/types/LlmModel';
import type { StyleSurface } from '../../api/types/StyleSurface';
import { listConversations } from '../../api/chat/listConversations';
import { getConversationMessages } from '../../api/chat/getConversationMessages';
import { getConversationSummary } from '../../api/chat/getConversationSummary';
import { renameConversation } from '../../api/chat/renameConversation';
import { patchConversation } from '../../api/chat/patchConversation';
import { chatStream } from '../../api/chat/chatStream';
import { researchStream } from '../../api/chat/researchStream';
import { listModels } from '../../api/models/listModels';
import { listStyles } from '../../api/styles/listStyles';
import { authClient } from '../../lib/auth-client';
import { ChatBubble } from '../../components/chat/ChatBubble';
import type { DisplayMessage } from '../../components/chat/DisplayMessage';
import { ComposerDock } from '../../components/ComposerDock';
import type { ComposerToggle } from '../../components/ComposerToggle';
import { Sheet } from '../../components/Sheet';
import { IconButton } from '../../components/IconButton';
import { styleLabel } from '../../lib/styles/styleLabel';
import { isTransientNetworkError } from '../../lib/network/isTransientNetworkError';
import { useOnVisibilityResume } from '../../hooks/useOnVisibilityResume';
import { useWasRecentlyHidden } from '../../hooks/useWasRecentlyHidden';
import { uid } from '../../lib/utils/uid';
import { replayStream } from '../../api/replayStream';
import { saveActiveStream, loadActiveStream, clearActiveStream } from '../../lib/activeStream';
import { SidebarBody } from './SidebarBody';
import { useAutoScrollToBottom } from './hooks/useAutoScrollToBottom';
import { labelForTool } from '../../lib/intent/labelForTool';
import type { ConsentRequest } from './types/ConsentRequest';

const EMPTY_STATE_PROMPTS = [
  'Summarise the last week of my work',
  'Help me plan a focused day',
  'Explain something I should understand by now',
];

export function ChatPage() {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState<string>('');

  const [chatStyles, setChatStyles] = useState<StyleSurface | null>(null);
  const [styleKey, setStyleKey] = useState<string>('');

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // RAG/knowledge flags only apply on the first turn of a new conversation; harness ignores them afterwards
  const [ragEnabled, setRagEnabled] = useState(false);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [searchMode, setSearchMode] = useState<'normal' | 'deep'>('normal');
  const streamAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRetry(convId: number) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      if (activeIdRef.current !== convId) return;
      try {
        const res = await getConversationMessages(convId);
        if (activeIdRef.current !== convId) return;
        const status = res.conversation?.status;
        if (status === 'processing') {
          // Drop reconnecting badge so the UI shows "Thinking…"
          setMessages((ms) =>
            ms.map((x) => {
              if (x.id === `pending-${convId}` || x.id === `resume-${convId}`) {
                return { ...x, reconnecting: false };
              }
              return x;
            }),
          );
          scheduleRetry(convId);
        } else {
          clearActiveStream();
          setMessages(hydrateMessages(res.messages));
        }
      } catch {}
    }, 4000);
  }

  const [alwaysAllowSearch, setAlwaysAllowSearch] = useState(false);
  const [grounding, setGrounding] = useState<boolean>(true);

  const [consentRequest, setConsentRequest] = useState<ConsentRequest | null>(null);

  const [stats, setStats] = useState<ConversationSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  async function refreshStats() {
    if (activeId == null) {
      setStats(null);
      return;
    }
    setLoadingStats(true);
    try {
      const summary = await getConversationSummary(activeId);
      setStats(summary);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }

  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScrollToBottom(messages);

  const vis = useWasRecentlyHidden();
  const initialLoadOkRef = useRef(false);

  const runInitialLoad = useRef<() => Promise<void>>(() => Promise.resolve());
  runInitialLoad.current = async () => {
    try {
      const [convRes, modelsRes, stylesRes] = await Promise.all([
        listConversations(),
        listModels(),
        listStyles('chat').catch(() => null),
      ]);
      setConversations(convRes.conversations.filter((c) => !c.deleted_at));
      setModels(modelsRes.models);
      const reasoner = modelsRes.models.find((m) => m.role === 'reasoner');
      setModel((prev) => prev || reasoner?.name || modelsRes.models[0]?.name || '');
      if (stylesRes?.chat) {
        setChatStyles(stylesRes.chat);
        setStyleKey((prev) => prev || stylesRes.chat!.default);
      }
      initialLoadOkRef.current = true;
      setError(null);
    } catch (err) {
      if (isTransientNetworkError(err)) return;
      setError((err as Error)?.message ?? 'Failed to load');
    } finally {
      setLoadingConversations(false);
    }
  };

  async function resumeActiveStream() {
    const stored = loadActiveStream();
    if (!stored) return;

    const { conversationId, jobId } = stored;

    // Load the conversation's current state from DB
    let res: { conversation: Conversation; messages: ChatMessageRow[] };
    try {
      res = await getConversationMessages(conversationId);
    } catch {
      clearActiveStream();
      return;
    }

    const convStatus = res.conversation?.status;

    // If already complete or errored, just render from DB
    if (convStatus !== 'processing') {
      clearActiveStream();
      setActiveId(conversationId);
      setModel(res.conversation?.model || model);
      setMessages(hydrateMessages(res.messages));
      return;
    }

    // Check if the assistant message already landed in DB
    const hasAssistantReply = res.messages.some(
      (m) => m.role === 'assistant' && m.content && m.content.length > 0,
    );

    // Set up the conversation in the UI
    setActiveId(conversationId);
    setModel(res.conversation?.model || model);

    const loaded = hydrateMessages(res.messages);
    const pendingId = `resume-${conversationId}`;
    setMessages([...loaded, {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
      startedAt: Date.now(),
      reconnecting: true,
    }]);

    // Try SSE replay first
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setSending(true);

    let replayWorked = false;
    try {
      const stream = replayStream(jobId, controller.signal);
      const first = await stream.next();

      if (!first.done) {
        // SSE replay is alive — process the full stream
        replayWorked = true;
        // Remove reconnecting badge
        setMessages((ms) =>
          ms.map((x) => x.id === pendingId ? { ...x, reconnecting: false } : x),
        );

        // Process the first event + rest of stream
        async function* prependFirst(
          firstVal: import('../../api/types/StreamEvent').StreamEvent,
          rest: AsyncGenerator<import('../../api/types/StreamEvent').StreamEvent, void, void>,
        ): AsyncGenerator<import('../../api/types/StreamEvent').StreamEvent, void, void> {
          yield firstVal;
          yield* rest;
        }

        await processStream(
          prependFirst(first.value, stream),
          pendingId,
          '',
          false,
          controller,
        );
      }
    } catch {
      // Replay failed, fall through to DB polling
    }

    if (!replayWorked) {
      // SSE replay unavailable — fall back to DB-based polling
      clearActiveStream();

      if (hasAssistantReply) {
        // Message already in DB, render it
        setMessages(hydrateMessages(res.messages));
        setSending(false);
      } else {
        // Still processing, poll for completion
        setSending(false);
        scheduleRetry(conversationId);
      }
      return;
    }

    setSending(false);
    if (streamAbortRef.current === controller) {
      streamAbortRef.current = null;
    }
  }

  useEffect(() => {
    void runInitialLoad.current().then(() => {
      void resumeActiveStream();
    });
    return () => {
      streamAbortRef.current?.abort();
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (stats?.conversation && 'contextual_grounding_enabled' in stats.conversation) {
      setGrounding(
        (stats.conversation as { contextual_grounding_enabled?: boolean })
          .contextual_grounding_enabled !== false,
      );
    }
  }, [stats]);

  async function toggleGrounding() {
    if (activeId == null) return;
    const next = !grounding;
    setGrounding(next);
    try {
      await patchConversation(activeId, { contextual_grounding_enabled: next });
    } catch (err) {
      setGrounding(!next);
      setError((err as Error)?.message ?? 'Failed to update grounding');
    }
  }

  useOnVisibilityResume(() => {
    if (!initialLoadOkRef.current) void runInitialLoad.current();
  });

  // Poll for deep search results when jobs are queued
  const hasWaitingDeepSearch = messages.some((m) => m.deepSearchStatus === 'waiting');
  useEffect(() => {
    if (!hasWaitingDeepSearch || activeId == null) return;
    const convId = activeId;
    const timer = setInterval(async () => {
      if (activeIdRef.current !== convId) return;
      try {
        const res = await getConversationMessages(convId);
        if (activeIdRef.current !== convId) return;
        const freshMessages = hydrateMessages(res.messages);
        const hasNewDeepResults = freshMessages.some(
          (m) => m.role === 'system' && m.content.startsWith('[Deep search result]'),
        );
        if (hasNewDeepResults) {
          setMessages((prev) => {
            // Merge: keep existing messages, append any new deep search results
            const existingIds = new Set(prev.map((m) => m.id));
            const newResults = freshMessages.filter(
              (m) => m.content.startsWith('[Deep search result]') && !existingIds.has(m.id),
            );
            if (newResults.length === 0) return prev;
            // Insert new results before the assistant message that has the waiting status
            const waitIdx = prev.findIndex((m) => m.deepSearchStatus === 'waiting');
            if (waitIdx < 0) return [...prev, ...newResults];
            const copy = prev.slice();
            copy.splice(waitIdx + 1, 0, ...newResults);
            return copy;
          });
        }
        // Check if all deep search jobs are done by seeing if fresh DB has no more pending
        // system messages arriving — if the count stabilises, mark as complete
        const dbDeepCount = freshMessages.filter(
          (m) => m.content.startsWith('[Deep search result]'),
        ).length;
        setMessages((prev) => {
          const prevDeepCount = prev.filter(
            (m) => m.content.startsWith('[Deep search result]'),
          ).length;
          // If we got results and count matches DB, mark complete
          if (dbDeepCount > 0 && dbDeepCount === prevDeepCount) {
            return prev.map((m) =>
              m.deepSearchStatus === 'waiting'
                ? { ...m, deepSearchStatus: 'complete' as const }
                : m,
            );
          }
          return prev;
        });
      } catch {}
    }, 18_000);
    return () => clearInterval(timer);
  }, [hasWaitingDeepSearch, activeId]);

  function hydrateMessages(msgs: ChatMessageRow[]): DisplayMessage[] {
    return msgs
      .filter((m) => m.role !== 'system' || m.content.startsWith('[Deep search result]'))
      .map<DisplayMessage>((m) => ({
        id: String(m.Id),
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        status: m.role === 'system' ? 'system' : 'complete',
        tokensIn: m.tokens_input,
        tokensOut: m.tokens_output,
        responseStyle: m.response_style ?? null,
        sources: m.search_sources?.length ? m.search_sources : undefined,
        searchConfidence: m.search_confidence ?? undefined,
        intent: m.classification?.intent ?? m.intent ?? undefined,
        searchStatus: m.search_status,
      }));
  }

  async function selectConversation(c: Conversation) {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setActiveId(c.Id);
    setModel(c.model || model);
    setLoadingMessages(true);
    setError(null);
    setStats(null);
    setConsentRequest(null);
    setRenameTitle(c.title || '');
    try {
      const saved = window.localStorage.getItem(`chatStyle:${c.Id}`);
      if (saved) setStyleKey(saved);
      else if (chatStyles) setStyleKey(chatStyles.default);
    } catch {}
    try {
      const res = await getConversationMessages(c.Id);
      const loaded = hydrateMessages(res.messages);
      const convStatus = res.conversation?.status;

      if (convStatus === 'processing') {
        setMessages([...loaded, {
          id: `pending-${c.Id}`,
          role: 'assistant',
          content: '',
          status: 'pending',
          startedAt: Date.now(),
          reconnecting: true,
        }]);
        setLoadingMessages(false);
        scheduleRetry(c.Id);
      } else if (convStatus === 'error') {
        setMessages(loaded);
        setError('The model encountered an error processing this conversation.');
        setLoadingMessages(false);
      } else {
        setMessages(loaded);
        setLoadingMessages(false);
      }
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load conversation');
      setLoadingMessages(false);
    }
  }

  function newChat() {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setActiveId(null);
    setMessages([]);
    setError(null);
    setStats(null);
    setRenameTitle('');
    setRagEnabled(false);
    setKnowledgeEnabled(false);
    setConsentRequest(null);
  }

  async function runChatStream(
    body: Parameters<typeof chatStream>[0],
    pendingId: string,
    userText: string,
  ): Promise<{ conversationId: number | null; consentNeeded: boolean }> {
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const stream = chatStream(body, controller.signal);
    return processStream(stream, pendingId, userText, body.conversation_id == null, controller);
  }

  async function runResearchStream(
    question: string,
    pendingId: string,
  ): Promise<{ conversationId: number | null; consentNeeded: boolean }> {
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const stream = researchStream(
      { model, question, conversation_id: activeId ?? undefined },
      controller.signal,
    );
    return processStream(stream, pendingId, question, activeId == null, controller);
  }

  async function processStream(
    stream: AsyncGenerator<import('../../api/types/StreamEvent').StreamEvent, void, void>,
    pendingId: string,
    userText: string,
    isFirstMessage: boolean,
    controller: AbortController,
  ): Promise<{ conversationId: number | null; consentNeeded: boolean }> {
    let newConversationId: number | null = null;
    let streamJobId: string | null = null;
    let consentNeeded = false;
    let consentArgs: { query: string; reason: string } | null = null;

    try {
      for await (const ev of stream) {
        if (ev.type === 'intent_classified') {
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, intent: ev.intent } : x)),
          );
          continue;
        }
        if (ev.type === 'jobs_queued') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, deepSearchStatus: 'waiting' as const, deepSearchMessage: ev.message }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'search_deferred') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, searchStatus: 'deferred' }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'searching') {
          flushSync(() => {
            setMessages((ms) =>
              ms.map((x) => (x.id === pendingId ? { ...x, status: 'searching', toolStatus: undefined } : x)),
            );
          });
          continue;
        }
        if (ev.type === 'tool_status') {
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
          continue;
        }
        if (ev.type === 'search_complete') {
          flushSync(() => {
            setMessages((ms) =>
              ms.map((x) =>
                x.id === pendingId
                  ? {
                      ...x,
                      status: 'pending',
                      sources: ev.sources,
                      searchConfidence: ev.confidence,
                      toolStatus: undefined,
                    }
                  : x,
              ),
            );
          });
          continue;
        }
        if (ev.type === 'research_status') {
          flushSync(() => {
            setMessages((ms) =>
              ms.map((x) => (x.id === pendingId ? { ...x, toolStatus: ev.message } : x)),
            );
          });
          continue;
        }
        if (ev.type === 'search_consent_required') {
          consentNeeded = true;
          consentArgs = { query: ev.query, reason: ev.reason };
          continue;
        }
        if (ev.type === 'thinking') {
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
        } else if (ev.type === 'chunk') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    status: 'streaming',
                    content: x.content + ev.text,
                    ...(x.isThinking
                      ? { isThinking: false, thinkingEndTime: Date.now() }
                      : {}),
                  }
                : x,
            ),
          );
        } else if (ev.type === 'summarised') {
          const notice: DisplayMessage = {
            id: uid(),
            role: 'system',
            status: 'system',
            content: `Trimmed ${ev.removed} earlier message${ev.removed === 1 ? '' : 's'} (≈${ev.summary_chars.toLocaleString()} chars summarised)`,
          };
          setMessages((ms) => {
            const idx = ms.findIndex((x) => x.id === pendingId);
            if (idx < 0) return [...ms, notice];
            const copy = ms.slice();
            copy.splice(idx, 0, notice);
            return copy;
          });
        } else if (ev.type === 'parsed') {
          if (ev.output != null) {
            setMessages((ms) =>
              ms.map((x) =>
                x.id === pendingId
                  ? { ...x, parsedOutput: ev.output }
                  : x,
              ),
            );
          }
        } else if (ev.type === 'meta') {
          if (ev.job_id) streamJobId = ev.job_id;
          if (ev.conversation_id != null && newConversationId == null) {
            newConversationId = ev.conversation_id;
            if (isFirstMessage) {
              setActiveId(newConversationId);
              listConversations().then((r) => setConversations(r.conversations.filter((c) => !c.deleted_at))).catch(() => {});
            }
          }
          if (streamJobId && newConversationId != null) {
            saveActiveStream({ conversationId: newConversationId, jobId: streamJobId });
          }
          if (ev.estimate) {
            const notice: DisplayMessage = {
              id: uid(),
              role: 'system',
              status: 'system',
              content: ev.estimate,
            };
            setMessages((ms) => {
              const idx = ms.findIndex((x) => x.id === pendingId);
              if (idx < 0) return [...ms, notice];
              const copy = ms.slice();
              copy.splice(idx, 0, notice);
              return copy;
            });
          }
        } else if (ev.type === 'done') {
          clearActiveStream();
          if (ev.conversation_id != null) newConversationId = ev.conversation_id;
          if (ev.awaiting === 'search_consent') {
            setMessages((ms) =>
              ms.map((x) =>
                x.id === pendingId
                  ? { ...x, status: 'pending', startedAt: undefined }
                  : x,
              ),
            );
            break;
          }
          const tokIn = ev.usage?.prompt_tokens ?? ev.tokens_input;
          const tokOut = ev.usage?.completion_tokens ?? ev.tokens_output;
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    status: 'complete',
                    isThinking: false,
                    startedAt: undefined,
                    tokensIn: tokIn,
                    tokensOut: tokOut,
                    contextChars:
                      ev.context_chars && ev.context_chars > 0 ? ev.context_chars : undefined,
                    searchStatus: ev.search_status,
                  }
                : x,
            ),
          );
        } else if (ev.type === 'error') {
          clearActiveStream();
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'error', errorMessage: ev.message }
                : x,
            ),
          );
          break;
        }
      }

      if (isFirstMessage && newConversationId != null && !consentNeeded) {
        setActiveId(newConversationId);
      }
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError';
      const transient =
        isTransientNetworkError(err) && (vis.isHidden() || vis.justResumed());
      if (!aborted && !transient) {
        // Real failure — clear activeStream and show error
        clearActiveStream();
        const msg = (err as Error)?.message ?? 'Send failed';
        setMessages((ms) =>
          ms.map((x) =>
            x.id === pendingId ? { ...x, status: 'error', errorMessage: msg } : x,
          ),
        );
        setError(msg);
      } else if (transient) {
        // Transient network error while hidden — remove pending bubble, keep
        // activeStream so reconnection can pick up where we left off.
        setMessages((ms) => ms.filter((x) => x.id !== pendingId));
      }
      // On abort (navigation away): don't clear activeStream — the user may
      // navigate back and resumeActiveStream will reconnect via replayStream.
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
    }

    if (consentNeeded && consentArgs) {
      setConsentRequest({
        query: consentArgs.query,
        reason: consentArgs.reason,
        pendingUserText: userText,
        pendingAssistantId: pendingId,
      });
    }

    return { conversationId: newConversationId, consentNeeded };
  }

  async function send(forcedText?: string) {
    if (researchEnabled && !forcedText) {
      return sendResearch();
    }
    const text = (forcedText ?? input).trim();
    if (!text || sending || !model) return;

    const userMsg: DisplayMessage = {
      id: uid(),
      role: 'user',
      content: text,
      status: 'complete',
    };
    const pendingId = uid();
    const pendingMsg: DisplayMessage = {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
      startedAt: Date.now(),
      responseStyle: styleKey || undefined,
      sourceUserText: text,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    if (!forcedText) setInput('');
    setSending(true);
    setError(null);

    const isFirstMessage = activeId == null;

    try {
      await runChatStream(
        {
          model,
          message: text,
          conversation_id: activeId ?? undefined,
          ...(isFirstMessage && ragEnabled ? { rag_enabled: true } : {}),
          ...(isFirstMessage && knowledgeEnabled ? { knowledge_enabled: true } : {}),
          ...(alwaysAllowSearch ? { search_enabled: true } : {}),
          ...(searchMode !== 'normal' ? { search_mode: searchMode } : {}),
          ...(styleKey ? { response_style: styleKey } : {}),
        },
        pendingId,
        text,
      );
    } finally {
      setSending(false);
    }
  }

  async function sendResearch() {
    const text = input.trim();
    if (!text || sending || !model) return;

    const userMsg: DisplayMessage = {
      id: uid(),
      role: 'user',
      content: text,
      status: 'complete',
    };
    const pendingId = uid();
    const pendingMsg: DisplayMessage = {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
      startedAt: Date.now(),
      sourceUserText: text,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      await runResearchStream(text, pendingId);
    } finally {
      setSending(false);
    }
  }

  async function resolveConsent(allow: boolean) {
    if (!consentRequest) return;
    const { pendingUserText, pendingAssistantId } = consentRequest;
    setConsentRequest(null);

    setMessages((ms) =>
      ms.map((x) =>
        x.id === pendingAssistantId
          ? { ...x, status: 'pending', content: '', startedAt: Date.now() }
          : x,
      ),
    );

    setSending(true);
    setError(null);
    try {
      await runChatStream(
        {
          model,
          message: pendingUserText,
          conversation_id: activeId ?? undefined,
          ...(allow ? { search_enabled: true } : { search_consent_declined: true }),
          ...(styleKey ? { response_style: styleKey } : {}),
        },
        pendingAssistantId,
        pendingUserText,
      );
    } finally {
      setSending(false);
    }
  }

  async function saveRename() {
    if (activeId == null) return;
    const title = renameTitle.trim();
    if (!title) {
      setRenameError('Title cannot be empty');
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await renameConversation(activeId, title);
      setConversations((cs) =>
        cs.map((c) => (c.Id === activeId ? { ...c, title } : c)),
      );
      if (stats && stats.conversation.Id === activeId) {
        setStats({ ...stats, conversation: { ...stats.conversation, title } });
      }
      setRenameTitle(title);
    } catch (err) {
      setRenameError((err as Error)?.message ?? 'Rename failed');
    } finally {
      setRenaming(false);
    }
  }

  async function deleteChat() {
    if (activeId == null) return;
    const confirmed = window.confirm('Delete this conversation? This cannot be undone.');
    if (!confirmed) return;
    try {
      await patchConversation(activeId, { deleted_at: new Date().toISOString() });
      setConversations((cs) => cs.filter((c) => c.Id !== activeId));
      newChat();
      setDrawerOpen(false);
    } catch (err) {
      setError((err as Error)?.message ?? 'Delete failed');
    }
  }

  async function logout() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  const activeConversation =
    activeId != null ? conversations.find((c) => c.Id === activeId) ?? null : null;

  return (
    <>
    <div className="h-full flex bg-bg text-fg">
      <aside className="hidden md:flex w-80 border-r border-border bg-panel/60 flex-col">
        <SidebarBody
          onNewChat={() => newChat()}
          conversations={conversations}
          activeId={activeId}
          onSelect={(c) => void selectConversation(c)}
          loading={loadingConversations}
        />
      </aside>

      <Sheet
        open={sidebarOpen}
        side="left"
        onClose={() => setSidebarOpen(false)}
        label="Conversations"
      >
        <SidebarBody
          onNewChat={() => {
            newChat();
            setSidebarOpen(false);
          }}
          conversations={conversations}
          activeId={activeId}
          onSelect={(c) => {
            void selectConversation(c);
            setSidebarOpen(false);
          }}
          loading={loadingConversations}
        />
      </Sheet>


      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-bg/80 backdrop-blur px-3 sm:px-6 md:px-8 py-3 md:py-5 flex items-center gap-3 md:gap-6">
          <div className="md:hidden">
            <IconButton
              onClick={() => setSidebarOpen(true)}
              label="Open conversations"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </IconButton>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
              {activeConversation ? 'Conversation' : 'Chat with Jeff'}
            </p>
            <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold truncate tracking-tightest">
              {activeConversation?.title || 'Untitled'}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <IconButton
              onClick={() => setDrawerOpen((v) => !v)}
              label={drawerOpen ? 'Hide properties' : 'Show properties'}
              active={drawerOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="8.01" />
                <line x1="11" y1="12" x2="12" y2="12" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="11" y1="16" x2="13" y2="16" />
              </svg>
            </IconButton>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 md:py-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {loadingMessages ? (
              <p className="text-center text-muted text-sm pt-16">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="pt-16 md:pt-20 text-center px-2">
                <p className="font-display text-3xl md:text-4xl font-semibold tracking-tightest leading-tight">
                  Ask Jeffy anything.
                </p>
                <p className="text-muted text-sm mt-3 font-sans">
                  {model ? `Model · ${model}` : 'Select a Jeff to begin'}
                </p>
                {model && (
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {EMPTY_STATE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setInput(p)}
                        className="text-[12px] sm:text-[13px] font-sans px-3 py-1.5 rounded-full border border-border text-muted bg-panel/40 hover:border-fg hover:text-fg transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <ChatBubble
                    message={m}
                    onRetry={(mm) => {
                      if (!mm.sourceUserText) return;
                      setMessages((ms) => {
                        const idx = ms.findIndex((x) => x.id === mm.id);
                        if (idx <= 0) return ms.filter((x) => x.id !== mm.id);
                        const prev = ms[idx - 1];
                        const toDrop = new Set([mm.id]);
                        if (prev?.role === 'user') toDrop.add(prev.id);
                        return ms.filter((x) => !toDrop.has(x.id));
                      });
                      void send(mm.sourceUserText);
                    }}
                    onEdit={
                      m.role === 'user' && !sending
                        ? (mm) => {
                            // drop this user msg and the assistant reply that follows (if any)
                            setMessages((ms) => {
                              const idx = ms.findIndex((x) => x.id === mm.id);
                              if (idx < 0) return ms;
                              const toDrop = new Set([mm.id]);
                              const next = ms[idx + 1];
                              if (next && next.role === 'assistant') toDrop.add(next.id);
                              return ms.filter((x) => !toDrop.has(x.id));
                            });
                            setInput(mm.content);
                          }
                        : undefined
                    }
                  />
                  {m.role === 'assistant' && m.status === 'complete' && m.responseStyle && (
                    <div className="flex justify-start">
                      <span className="text-[9px] font-sans uppercase tracking-[0.14em] text-muted pl-5 inline-flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-fg/50" />
                        {styleLabel(m.responseStyle)}
                      </span>
                    </div>
                  )}
                  {m.role === 'assistant' && m.status === 'complete' && m.contextChars != null && (
                    <div className="flex justify-start">
                      <span className="text-[10px] font-sans uppercase tracking-[0.14em] text-muted pl-5">
                        Memory · {m.contextChars.toLocaleString()} chars of context
                        {m.tokensOut != null && (
                          <span className="ml-2">· {m.tokensOut.toLocaleString()} tok out</span>
                        )}
                      </span>
                    </div>
                  )}
                  {m.role === 'assistant' &&
                    m.status === 'complete' &&
                    m.contextChars == null &&
                    m.tokensOut != null && (
                      <div className="flex justify-start">
                        <span className="text-[10px] font-sans uppercase tracking-[0.14em] text-muted pl-5">
                          {m.tokensOut.toLocaleString()} tok out
                          {m.tokensIn != null && (
                            <span className="ml-2">· {m.tokensIn.toLocaleString()} in</span>
                          )}
                        </span>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

        {!isAtBottom && messages.length > 0 && (
          <div className="px-3 sm:px-6 pb-2 pointer-events-none">
            <div className="max-w-3xl mx-auto flex justify-center">
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

        {consentRequest && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3 text-[13px] font-sans text-muted bg-panel border border-border rounded-lg px-4 py-2.5">
              <span className="w-full sm:w-auto sm:flex-1 min-w-0">
                This might benefit from a web search
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => void resolveConsent(true)}
                  className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md bg-fg text-bg hover:bg-fg/85 transition-colors"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => void resolveConsent(false)}
                  className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-border text-fg hover:bg-panelHi transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-red-600 font-sans break-words">{error}</p>
            </div>
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
          placeholder={model ? 'Message JeffGPT…' : 'Load a Jeff to start'}
          models={models}
          model={model}
          onModelChange={setModel}
          styles={chatStyles?.styles}
          styleKey={styleKey}
          onStyleChange={(k) => {
            setStyleKey(k);
            if (activeId != null) {
              try {
                window.localStorage.setItem(`chatStyle:${activeId}`, k);
              } catch {}
            }
          }}
          toggles={
            [
              {
                key: 'memory',
                label: 'Memory',
                active: ragEnabled,
                disabled: activeId != null,
                title:
                  activeId != null
                    ? 'Memory is set when a conversation is first created'
                    : 'Use past conversations as context',
                onToggle: () => setRagEnabled((v) => !v),
              },
              {
                key: 'knowledge',
                label: 'Knowledge',
                active: knowledgeEnabled,
                disabled: activeId != null,
                title:
                  activeId != null
                    ? 'Knowledge graph is set when a conversation is first created'
                    : 'Extract entities and write concept edges to the knowledge graph',
                onToggle: () => setKnowledgeEnabled((v) => !v),
              },
              {
                key: 'research',
                label: 'Research',
                active: researchEnabled,
                title: 'Run a multi-step research workflow instead of a normal chat reply',
                onToggle: () => setResearchEnabled((v) => !v),
              },
              {
                key: 'deep',
                label: 'Deep Search',
                active: searchMode === 'deep',
                title: 'Search + model summarisation + reranking (slower, higher quality)',
                onToggle: () => setSearchMode((m) => m === 'deep' ? 'normal' : 'deep'),
              },
            ] satisfies ComposerToggle[]
          }
        />
      </main>

      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close properties"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-fg/40 backdrop-blur-sm animate-backdrop"
          />
          <aside className="z-50 fixed inset-y-0 right-0 w-[92vw] max-w-[380px] md:static md:inset-auto md:w-[380px] shrink-0 border-l border-border bg-bg md:bg-panel/40 flex flex-col animate-sheet-right md:animate-fadeIn">
          <header className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Chat</p>
              <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
                Properties
              </h3>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="shrink-0 w-9 h-9 -mr-2 rounded-md border border-border text-fg hover:bg-panelHi flex items-center justify-center text-xl leading-none"
              aria-label="Close properties"
            >
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Title
              </h4>
              <input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder={activeConversation?.title || 'Untitled'}
                disabled={activeId == null || renaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveRename();
                  }
                }}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-fg disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] font-sans text-muted">
                  {renameError ? (
                    <span className="text-red-600">{renameError}</span>
                  ) : (
                    'Enter to save'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void saveRename()}
                  disabled={
                    activeId == null ||
                    renaming ||
                    !renameTitle.trim() ||
                    renameTitle.trim() === (activeConversation?.title ?? '')
                  }
                  className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg disabled:cursor-not-allowed"
                >
                  {renaming ? '…' : 'Save'}
                </button>
              </div>
            </section>

            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                Settings
              </h4>
              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-sans">
                <dt className="text-muted">Type of Jeff</dt>
                <dd className="text-right truncate">{model || '—'}</dd>
                <dt className="text-muted">Memory</dt>
                <dd className="text-right">
                  {activeId == null
                    ? ragEnabled
                      ? 'on (first turn)'
                      : 'off'
                    : (stats?.conversation as any)?.rag_enabled
                      ? 'on'
                      : 'sticky'}
                </dd>
                <dt className="text-muted">Knowledge</dt>
                <dd className="text-right">
                  {activeId == null ? (knowledgeEnabled ? 'on (first turn)' : 'off') : 'sticky'}
                </dd>
                <dt className="text-muted">Search</dt>
                <dd className="text-right">
                  {alwaysAllowSearch ? 'always on' : 'auto-detected'}
                </dd>
              </dl>
              <p className="text-[10px] font-sans text-muted mt-2 leading-relaxed">
                Memory / Knowledge are captured when the chat is first created.
                Search is auto-detected by the harness.
              </p>

              <label className="mt-3 flex items-center justify-between gap-2 text-[11px] font-sans text-fg cursor-pointer select-none">
                <span>
                  <span className="text-muted uppercase tracking-[0.14em] text-[10px] block">
                    Always allow web search
                  </span>
                  <span className="text-[10px] text-muted">skip the consent dialog</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alwaysAllowSearch}
                  onClick={() => setAlwaysAllowSearch((v) => !v)}
                  className={[
                    'relative w-9 h-5 rounded-full border transition-colors shrink-0',
                    alwaysAllowSearch ? 'bg-fg border-fg' : 'bg-bg border-border',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform',
                      alwaysAllowSearch ? 'left-0.5 translate-x-4 bg-bg' : 'left-0.5 bg-fg',
                    ].join(' ')}
                  />
                </button>
              </label>

              <label className="mt-3 flex items-center justify-between gap-2 text-[11px] font-sans text-fg cursor-pointer select-none">
                <span>
                  <span className="text-muted uppercase tracking-[0.14em] text-[10px] block">
                    Contextual grounding
                  </span>
                  <span className="text-[10px] text-muted">
                    Pull current facts when the model spots real-world entities
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={grounding}
                  disabled={activeId == null}
                  onClick={() => void toggleGrounding()}
                  className={[
                    'relative w-9 h-5 rounded-full border transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed',
                    grounding ? 'bg-fg border-fg' : 'bg-bg border-border',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform',
                      grounding ? 'left-0.5 translate-x-4 bg-bg' : 'left-0.5 bg-fg',
                    ].join(' ')}
                  />
                </button>
              </label>
            </section>

            <details open className="group">
              <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Stats</h4>
                <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
              </summary>
              <div className="flex justify-end -mt-1 mb-2">
                <button
                  onClick={() => void refreshStats()}
                  disabled={activeId == null || loadingStats}
                  className="text-[10px] uppercase tracking-[0.14em] font-sans text-fg hover:underline underline-offset-4 disabled:opacity-40"
                >
                  {loadingStats ? '…' : 'Refresh'}
                </button>
              </div>

              {activeId == null ? (
                <p className="text-[11px] text-muted font-sans">Select a conversation.</p>
              ) : stats == null ? (
                <p className="text-[11px] text-muted font-sans">Tap refresh to load.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-y-1 text-[11px] font-sans">
                    <dt className="text-muted">messages</dt>
                    <dd className="text-right">{stats.message_count}</dd>
                    <dt className="text-muted">runs</dt>
                    <dd className="text-right">{stats.run_count}</dd>
                    <dt className="text-muted">observations</dt>
                    <dd className="text-right">{stats.observation_count}</dd>
                    <dt className="text-muted">tasks</dt>
                    <dd className="text-right">{stats.task_count}</dd>

                    <dt className="text-muted mt-2 pt-2 border-t border-border">tokens in</dt>
                    <dd className="text-right mt-2 pt-2 border-t border-border">
                      {stats.tokens_input.toLocaleString()}
                    </dd>
                    <dt className="text-muted">tokens out</dt>
                    <dd className="text-right">{stats.tokens_output.toLocaleString()}</dd>
                    <dt className="text-muted font-semibold">total</dt>
                    <dd className="text-right font-semibold">
                      {stats.tokens_total.toLocaleString()}
                    </dd>

                    {stats.run_duration_seconds > 0 && (
                      <>
                        <dt className="text-muted mt-2 pt-2 border-t border-border">run time</dt>
                        <dd className="text-right mt-2 pt-2 border-t border-border">
                          {stats.run_duration_seconds.toFixed(2)}s
                        </dd>
                      </>
                    )}
                  </dl>

                  {stats.models_used.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">
                        Models
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stats.models_used.map((m) => (
                          <span
                            key={m}
                            className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-border bg-bg"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.themes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">
                        Themes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stats.themes.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-sans px-1.5 py-0.5 rounded-full border border-border bg-bg"
                          >
                            {t}
                            {stats.theme_counts[t] != null && (
                              <span className="text-muted ml-1">·{stats.theme_counts[t]}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </details>

            {activeId != null && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Danger zone
                </h4>
                <button
                  type="button"
                  onClick={() => void deleteChat()}
                  className="w-full text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-2 rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-bg transition-colors"
                >
                  Delete conversation
                </button>
              </section>
            )}

            {stats && stats.observations.length > 0 && (
              <details className="group">
                <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    Observations · {stats.observation_count}
                  </h4>
                  <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
                </summary>
                <ul className="space-y-3">
                  {stats.observations.map((o) => (
                    <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-[13px] leading-snug">{o.title}</p>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                            o.confidence === 'high'
                              ? 'border-fg text-fg'
                              : o.confidence === 'medium'
                                ? 'border-muted text-muted'
                                : 'border-border text-muted'
                          }`}
                        >
                          {o.confidence}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">{o.content}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] font-sans text-muted">
                          {o.type} · {o.domain}
                        </span>
                        {o.agent_name && (
                          <span className="text-[10px] font-sans text-muted">
                            · {o.agent_name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {stats && stats.runs.length > 0 && (
              <details className="group">
                <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    Agent runs · {stats.run_count}
                  </h4>
                  <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
                </summary>
                <ul className="space-y-3">
                  {stats.runs.map((r) => (
                    <li key={r.Id} className="border border-border rounded-md p-3 bg-bg">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-[13px]">{r.agent_name}</p>
                        <span className="text-[10px] font-sans text-muted">{r.status}</span>
                      </div>
                      {r.summary && (
                        <p className="text-[11px] text-muted mb-2 leading-relaxed">
                          {r.summary}
                        </p>
                      )}
                      <dl className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-sans text-muted">
                        <dt>in</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.tokens_input ?? 0).toLocaleString()}
                        </dd>
                        <dt>out</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.tokens_output ?? 0).toLocaleString()}
                        </dd>
                        {r.context_tokens != null && (
                          <>
                            <dt>ctx</dt>
                            <dd className="col-span-2 text-fg">
                              {r.context_tokens.toLocaleString()}
                            </dd>
                          </>
                        )}
                        <dt>time</dt>
                        <dd className="col-span-2 text-fg">
                          {(r.duration_seconds ?? 0).toFixed(2)}s
                        </dd>
                        {r.model_name && (
                          <>
                            <dt>model</dt>
                            <dd className="col-span-2 text-fg truncate">{r.model_name}</dd>
                          </>
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {stats && stats.outputs.length > 0 && (
              <details className="group">
                <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    Outputs · {stats.output_count}
                  </h4>
                  <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
                </summary>
                <ul className="space-y-3">
                  {stats.outputs.map((o) => (
                    <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
                        {o.agent_name ?? `run #${o.run_id}`}
                      </p>
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                        {o.full_text}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </aside>
        </>
      )}
    </div>
    </>
  );
}
