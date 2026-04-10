import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  type ChatMessageRow,
  type Conversation,
  type ConversationSummary,
  type LlmModel,
  type StyleSurface,
} from '../lib/api';
import { authClient } from '../lib/auth-client';
import { ConversationList } from '../components/ConversationList';
import { ChatBubble, type DisplayMessage } from '../components/ChatBubble';
import { ComposerDock, type ComposerToggle } from '../components/ComposerDock';
import { Sheet, IconButton } from '../components/Sheet';
import { styleLabel } from '../lib/styles';
import {
  isTransientNetworkError,
  useOnVisibilityResume,
  useWasRecentlyHidden,
} from '../lib/network';


function uid() {
  return Math.random().toString(36).slice(2);
}

function ChatPage() {
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
  const streamAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRetry(convId: number) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      if (activeIdRef.current !== convId) return;
      try {
        const res = await api.conversationMessages(convId);
        if (activeIdRef.current !== convId) return;
        const status = res.conversation?.status;
        if (status === 'processing') {
          scheduleRetry(convId);
        } else {
          setMessages(hydrateMessages(res.messages));
        }
      } catch {}
    }, 4000);
  }

  const [alwaysAllowSearch, setAlwaysAllowSearch] = useState(false);

  const [consentRequest, setConsentRequest] = useState<{
    query: string;
    reason: string;
    pendingUserText: string;
    pendingAssistantId: string;
  } | null>(null);

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
      const summary = await api.conversationSummary(activeId);
      setStats(summary);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  const vis = useWasRecentlyHidden();
  const initialLoadOkRef = useRef(false);

  const runInitialLoad = useRef<() => Promise<void>>(() => Promise.resolve());
  runInitialLoad.current = async () => {
    try {
      const [convRes, modelsRes, stylesRes] = await Promise.all([
        api.conversations(),
        api.models(),
        api.styles('chat').catch(() => null),
      ]);
      setConversations(convRes.conversations);
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

  useEffect(() => {
    void runInitialLoad.current();
  }, []);

  useOnVisibilityResume(() => {
    if (!initialLoadOkRef.current) void runInitialLoad.current();
  });


  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  function hydrateMessages(msgs: ChatMessageRow[]): DisplayMessage[] {
    return msgs
      .filter((m) => m.role !== 'system')
      .map<DisplayMessage>((m) => ({
        id: String(m.Id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        status: 'complete',
        tokensIn: m.tokens_input,
        tokensOut: m.tokens_output,
        responseStyle: m.response_style ?? null,
        sources: m.search_sources?.length ? m.search_sources : undefined,
        searchConfidence: m.search_confidence ?? undefined,
        searchFailed: m.search_status === 'error' || m.search_status === 'no_results',
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
      const res = await api.conversationMessages(c.Id);
      const loaded = hydrateMessages(res.messages);
      const convStatus = res.conversation?.status;

      if (convStatus === 'processing') {
        setMessages([...loaded, {
          id: `pending-${c.Id}`,
          role: 'assistant',
          content: '',
          status: 'pending',
          startedAt: Date.now(),
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
    body: Parameters<typeof api.chatStream>[0],
    pendingId: string,
    userText: string,
  ): Promise<{ conversationId: number | null; consentNeeded: boolean }> {
    const isFirstMessage = body.conversation_id == null;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    let newConversationId: number | null = null;
    let consentNeeded = false;
    let consentArgs: { query: string; reason: string } | null = null;

    try {
      const stream = api.chatStream(body, controller.signal);
      for await (const ev of stream) {
        if (ev.type === 'searching') {
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, status: 'searching' } : x)),
          );
          continue;
        }
        if (ev.type === 'search_complete') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    status: 'pending',
                    sources: ev.sources,
                    searchConfidence: ev.confidence,
                    searchFailed: !ev.ok,
                  }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'search_consent_required') {
          consentNeeded = true;
          consentArgs = { query: ev.query, reason: ev.reason };
          continue;
        }
        if (ev.type === 'chunk') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'streaming', content: x.content + ev.text }
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
          if (ev.conversation_id != null && newConversationId == null) {
            newConversationId = ev.conversation_id;
            if (isFirstMessage) {
              setActiveId(newConversationId);
              api.conversations().then((r) => setConversations(r.conversations)).catch(() => {});
            }
          }
        } else if (ev.type === 'done') {
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
                    startedAt: undefined,
                    tokensIn: tokIn,
                    tokensOut: tokOut,
                    contextChars:
                      ev.context_chars && ev.context_chars > 0 ? ev.context_chars : undefined,
                  }
                : x,
            ),
          );
        } else if (ev.type === 'error') {
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
          ...(styleKey ? { response_style: styleKey } : {}),
        },
        pendingId,
        text,
      );
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
      await api.renameConversation(activeId, title);
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

  async function logout() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  const activeConversation =
    activeId != null ? conversations.find((c) => c.Id === activeId) ?? null : null;

  return (
    <>
    <div className="h-full flex bg-bg text-fg">
      {/* ——— Sidebar (desktop column) ——— */}
      <aside className="hidden md:flex w-80 border-r border-border bg-panel/60 flex-col">
        <SidebarBody
          onNewChat={() => newChat()}
          conversations={conversations}
          activeId={activeId}
          onSelect={(c) => void selectConversation(c)}
          loading={loadingConversations}
        />
      </aside>

      {/* ——— Sidebar (mobile off-canvas sheet) ——— */}
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


      {/* ——— Main thread ——— */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className={[
                'text-[11px] uppercase tracking-[0.14em] font-sans px-2 sm:px-3 py-1.5 rounded-md border transition-colors',
                drawerOpen
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-fg hover:bg-panelHi',
              ].join(' ')}
              title="Show Jeff properties"
            >
              <span className="hidden sm:inline">Properties</span>
              <span className="sm:hidden">Info</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 md:py-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {loadingMessages ? (
              <p className="text-center text-muted text-sm pt-16">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="pt-20 text-center">
                <p className="font-display text-4xl font-semibold tracking-tightest leading-tight">
                  Ask Jeffy anything.
                </p>
                <p className="text-muted text-sm mt-3 font-sans">
                  {model ? `Model · ${model}` : 'Select a Jeff to begin'}
                </p>
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

        {/* ——— Inline search consent prompt ——— */}
        {consentRequest && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto flex items-center gap-3 text-[13px] font-sans text-muted bg-panel border border-border rounded-lg px-4 py-2.5">
              <span className="flex-1">This might benefit from a web search</span>
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
        )}

        {error && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-red-600 font-sans break-words">{error}</p>
            </div>
          </div>
        )}

        {/* Composer dock — model / style / toggles live here now */}
        <ComposerDock
          value={input}
          onChange={setInput}
          onSend={() => void send()}
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
            ] satisfies ComposerToggle[]
          }
        />
      </main>

      {/* ——— Right rail: Properties drawer. Column on md+, full-screen
              overlay with backdrop on mobile.                          ——— */}
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
              className="text-fg text-xl leading-none px-2 -mr-2 hover:opacity-60"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
            {/* Rename */}
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

            {/* Settings (placeholders for per-turn controls) */}
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
            </section>

            {/* Stats header + refresh */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Stats</h4>
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
            </section>

            {/* Observations */}
            {stats && stats.observations.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Observations · {stats.observation_count}
                </h4>
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
              </section>
            )}

            {/* Runs */}
            {stats && stats.runs.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Agent runs · {stats.run_count}
                </h4>
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
              </section>
            )}

            {/* Outputs */}
            {stats && stats.outputs.length > 0 && (
              <section>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
                  Outputs · {stats.output_count}
                </h4>
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
              </section>
            )}
          </div>
        </aside>
        </>
      )}
    </div>
    </>
  );
}

function SidebarBody({
  onNewChat,
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  onNewChat: () => void;
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (c: Conversation) => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <h1 className="font-display text-3xl font-semibold tracking-tightest leading-none">
          Jeff<span className="italic">GPT</span>
          <span className="inline-block w-2 h-2 bg-fg rounded-full align-middle ml-2" />
        </h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mt-2">
          local intelligence
        </p>
      </div>

      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-fg bg-bg text-fg text-sm font-medium hover:bg-fg hover:text-bg transition-colors"
        >
          <span>New conversation</span>
          <span className="text-lg leading-none">＋</span>
        </button>
      </div>

      <div className="px-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted mt-3 mb-1 px-1">
          History
        </p>
      </div>
      <div className="px-3 flex-1 overflow-y-auto pb-4 min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={onSelect}
          loading={loading}
        />
      </div>
    </>
  );
}

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ChatPage,
});
