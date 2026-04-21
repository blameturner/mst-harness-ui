import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChatBubble } from '../../components/chat/ChatBubble';
import { ComposerDock } from '../../components/ComposerDock';
import { Sheet } from '../../components/Sheet';
import { styleLabel } from '../../lib/styles/styleLabel';
import { patchConversation } from '../../api/chat/patchConversation';
import { useWasRecentlyHidden } from '../../hooks/useWasRecentlyHidden';
import { SidebarBody } from './SidebarBody';
import { ChatHeader } from './components/ChatHeader';
import { PropertiesDrawer } from './components/PropertiesDrawer';
import { SearchModeSelector } from './components/SearchModeSelector';
import { useAutoScrollToBottom } from './hooks/useAutoScrollToBottom';
import { useChatConfig } from './hooks/useChatConfig';
import { useConversations } from './hooks/useConversations';
import { useChat } from './hooks/useChat';
import { useStreamRecovery } from './hooks/useStreamRecovery';
import { loadSearchMode, saveSearchMode } from './lib/searchModeStorage';

const EMPTY_STATE_PROMPTS = [
  'Summarise the last week of my work',
  'Help me plan a focused day',
  'Explain something I should understand by now',
];

export function ChatPage() {
  const navigate = useNavigate();
  void navigate; // available for future use (logout etc.)

  const vis = useWasRecentlyHidden();

  const config = useChatConfig();
  const convs = useConversations();

  const activeIdRef = useRef(convs.activeId);
  activeIdRef.current = convs.activeId;

  const chat = useChat({
    activeId: convs.activeId,
    activeIdRef,
    model: config.model,
    styleKey: config.styleKey,
    searchMode: config.searchMode,
    ragEnabled: config.ragEnabled,
    knowledgeEnabled: config.knowledgeEnabled,
    setActiveId: convs.setActiveId,
    setConversations: convs.setConversations,
    setConversationTopics: convs.setConversationTopics,
    visIsHidden: vis.isHidden,
    visJustResumed: vis.justResumed,
  });

  // Load persisted search mode when the active conversation changes.
  useEffect(() => {
    config.setSearchMode(loadSearchMode(convs.activeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.activeId]);

  const recovery = useStreamRecovery({
    activeIdRef,
    model: config.model,
    setActiveId: convs.setActiveId,
    setModel: config.setModel as (m: string) => void,
    setModels: config.setModels,
    setMessages: chat.setMessages,
    setSending: chat.setSending,
    setConversations: convs.setConversations,
    setLoadingConversations: convs.setLoadingConversations,
    setError: chat.setError,
    setChatStyles: config.setChatStyles,
    setStyleKey: config.setStyleKey as (v: string) => void,
    setConversationTopics: convs.setConversationTopics,
    streamAbortRef: chat.streamAbortRef,
    processStream: chat.processStream,
  });

  // Sync grounding from stats
  useEffect(() => {
    if (convs.stats?.conversation && 'contextual_grounding_enabled' in convs.stats.conversation) {
      config.setGrounding(
        (convs.stats.conversation as { contextual_grounding_enabled?: boolean })
          .contextual_grounding_enabled !== false,
      );
    }
  }, [convs.stats]);

  async function toggleGrounding() {
    if (convs.activeId == null) return;
    const next = !config.grounding;
    config.setGrounding(next);
    try {
      await patchConversation(convs.activeId, { contextual_grounding_enabled: next });
    } catch (err) {
      config.setGrounding(!next);
      chat.setError((err as Error)?.message ?? 'Failed to update grounding');
    }
  }

  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScrollToBottom(chat.messages);

  const newChatOpts = {
    setMessages: chat.setMessages,
    setError: chat.setError,
    clearRetryTimer: recovery.clearRetryTimer,
  };

  function changeSearchMode(mode: typeof config.searchMode) {
    config.setSearchMode(mode);
    saveSearchMode(convs.activeId, mode);
  }

  async function handleConsentRun(m: import('../../components/chat/DisplayMessage').DisplayMessage) {
    if (!m.sourceUserText) return;
    await chat.retryWithConsent({
      pendingAssistantId: m.id,
      userText: m.sourceUserText,
      mode: config.searchMode,
      confirmed: true,
    });
  }

  async function handleConsentSkip(m: import('../../components/chat/DisplayMessage').DisplayMessage) {
    if (!m.sourceUserText) return;
    changeSearchMode('disabled');
    await chat.retryWithConsent({
      pendingAssistantId: m.id,
      userText: m.sourceUserText,
      mode: 'disabled',
      confirmed: false,
    });
  }

  return (
    <>
    <div className="h-full flex bg-bg text-fg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-80 border-r border-border bg-panel/60 flex-col">
        <SidebarBody
          onNewChat={() => convs.newChat(newChatOpts)}
          conversations={convs.conversations}
          activeId={convs.activeId}
          onSelect={(c) => void convs.selectConversation(c, {
            model: config.model,
            chatStyles: config.chatStyles,
            setStyleKey: config.setStyleKey,
            setMessages: chat.setMessages,
            setError: chat.setError,
            scheduleRetry: recovery.scheduleRetry,
            setModel: config.setModel,
          })}
          loading={convs.loadingConversations}
        />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet
        open={convs.sidebarOpen}
        side="left"
        onClose={() => convs.setSidebarOpen(false)}
        label="Conversations"
      >
        <SidebarBody
          onNewChat={() => {
            convs.newChat(newChatOpts);
            convs.setSidebarOpen(false);
          }}
          conversations={convs.conversations}
          activeId={convs.activeId}
          onSelect={(c) => {
            void convs.selectConversation(c, {
              model: config.model,
              chatStyles: config.chatStyles,
              setStyleKey: config.setStyleKey,
              setMessages: chat.setMessages,
              setError: chat.setError,
              scheduleRetry: recovery.scheduleRetry,
              setModel: config.setModel,
            });
            convs.setSidebarOpen(false);
          }}
          loading={convs.loadingConversations}
        />
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          activeConversation={convs.activeConversation}
          conversationTopics={convs.conversationTopics}
          onOpenSidebar={() => convs.setSidebarOpen(true)}
          drawerOpen={convs.drawerOpen}
          onToggleDrawer={() => convs.setDrawerOpen((v) => !v)}
        />

        {/* Message list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 md:py-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {chat.messages.length === 0 ? (
              <div className="pt-16 md:pt-20 text-center px-2">
                <p className="font-display text-3xl md:text-4xl font-semibold tracking-tightest leading-tight">
                  Ask Jeffy anything.
                </p>
                <p className="text-muted text-sm mt-3 font-sans">
                  {config.model ? `Model \u00b7 ${config.model}` : 'Select a Jeff to begin'}
                </p>
                {config.model && (
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {EMPTY_STATE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => chat.setInput(p)}
                        className="text-[12px] sm:text-[13px] font-sans px-3 py-1.5 rounded-full border border-border text-muted bg-panel/40 hover:border-fg hover:text-fg transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              chat.messages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <ChatBubble
                    message={m}
                    onConsentRun={handleConsentRun}
                    onConsentSkip={handleConsentSkip}
                    onRetry={(mm) => {
                      if (!mm.sourceUserText) return;
                      chat.setMessages((ms) => {
                        const idx = ms.findIndex((x) => x.id === mm.id);
                        if (idx <= 0) return ms.filter((x) => x.id !== mm.id);
                        const prev = ms[idx - 1];
                        const toDrop = new Set([mm.id]);
                        if (prev?.role === 'user') toDrop.add(prev.id);
                        return ms.filter((x) => !toDrop.has(x.id));
                      });
                      void chat.send(mm.sourceUserText);
                    }}
                    onEdit={
                      m.role === 'user' && !chat.sending
                        ? (mm) => {
                            chat.setMessages((ms) => {
                              const idx = ms.findIndex((x) => x.id === mm.id);
                              if (idx < 0) return ms;
                              const toDrop = new Set([mm.id]);
                              const next = ms[idx + 1];
                              if (next && next.role === 'assistant') toDrop.add(next.id);
                              return ms.filter((x) => !toDrop.has(x.id));
                            });
                            chat.setInput(mm.content);
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
                        Memory \u00b7 {m.contextChars.toLocaleString()} chars of context
                        {m.tokensOut != null && (
                          <span className="ml-2">\u00b7 {m.tokensOut.toLocaleString()} tok out</span>
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
                            <span className="ml-2">\u00b7 {m.tokensIn.toLocaleString()} in</span>
                          )}
                        </span>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Jump to bottom */}
        {!isAtBottom && chat.messages.length > 0 && (
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

        {/* Error banner */}
        {chat.error && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-red-600 font-sans break-words">{chat.error}</p>
            </div>
          </div>
        )}

        {/* Composer */}
        <ComposerDock
          value={chat.input}
          onChange={chat.setInput}
          onSend={() => void chat.send()}
          onStop={() => { chat.streamAbortRef.current?.abort(); }}
          sending={chat.sending}
          disabled={!config.model}
          placeholder={config.model ? 'Message JeffGPT\u2026' : 'Load a Jeff to start'}
          models={config.models}
          model={config.model}
          onModelChange={config.setModel}
          styles={config.chatStyles?.styles}
          styleKey={config.styleKey}
          onStyleChange={(k) => {
            config.setStyleKey(k);
            if (convs.activeId != null) {
              try { window.localStorage.setItem(`chatStyle:${convs.activeId}`, k); } catch {}
            }
          }}
          toggles={config.buildToggles(convs.activeId)}
          searchSlot={
            <SearchModeSelector
              value={config.searchMode}
              onChange={changeSearchMode}
            />
          }
        />
      </main>

      {/* Properties drawer */}
      {convs.drawerOpen && (
        <PropertiesDrawer
          activeId={convs.activeId}
          model={config.model}
          ragEnabled={config.ragEnabled}
          knowledgeEnabled={config.knowledgeEnabled}
          searchMode={config.searchMode}
          grounding={config.grounding}
          toggleGrounding={toggleGrounding}
          stats={convs.stats}
          loadingStats={convs.loadingStats}
          refreshStats={() => void convs.refreshStats()}
          renameTitle={convs.renameTitle}
          setRenameTitle={convs.setRenameTitle}
          renaming={convs.renaming}
          renameError={convs.renameError}
          saveRename={() => void convs.saveRename()}
          deleteChat={() => void convs.deleteChat(newChatOpts)}
          activeTitle={convs.activeConversation?.title ?? ''}
          onClose={() => convs.setDrawerOpen(false)}
        />
      )}
    </div>
    </>
  );
}
