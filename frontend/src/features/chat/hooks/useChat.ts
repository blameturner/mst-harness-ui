import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { StreamEvent } from '../../../api/types/StreamEvent';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import { chatStream } from '../../../api/chat/chatStream';
import { researchStream } from '../../../api/chat/researchStream';
import { listConversations } from '../../../api/chat/listConversations';
import { saveActiveStream, clearActiveStream } from '../../../lib/activeStream';
import { isTransientNetworkError } from '../../../lib/network/isTransientNetworkError';
import { uid } from '../../../lib/utils/uid';
import { labelForTool } from '../../../lib/intent/labelForTool';
import type { ConsentRequest } from '../types/ConsentRequest';

interface UseChatDeps {
  activeId: number | null;
  activeIdRef: React.RefObject<number | null>;
  model: string;
  styleKey: string;
  searchMode: 'normal' | 'deep' | 'research';
  searchSuppressed: boolean;
  alwaysAllowSearch: boolean;
  ragEnabled: boolean;
  knowledgeEnabled: boolean;
  researchEnabled: boolean;
  setActiveId: (id: number | null) => void;
  setConversations: React.Dispatch<React.SetStateAction<import('../../../api/types/Conversation').Conversation[]>>;
  setConversationTopics: (topics: string[]) => void;
  visIsHidden: () => boolean;
  visJustResumed: () => boolean;
}

export interface ChatState {
  messages: DisplayMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  sending: boolean;
  setSending: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  input: string;
  setInput: (v: string) => void;
  consentRequest: ConsentRequest | null;
  setConsentRequest: (v: ConsentRequest | null) => void;
  streamAbortRef: React.RefObject<AbortController | null>;

  send: (forcedText?: string, searchModeOverride?: 'deep' | 'deep_approved' | 'research' | 'research_approved') => Promise<void>;
  sendResearch: () => Promise<void>;
  resolveConsent: (allow: boolean) => Promise<void>;
  processStream: (
    stream: AsyncGenerator<StreamEvent, void, void>,
    pendingId: string,
    userText: string,
    isFirstMessage: boolean,
    controller: AbortController,
  ) => Promise<{ conversationId: number | null; consentNeeded: boolean }>;
  runChatStream: (
    body: Parameters<typeof chatStream>[0],
    pendingId: string,
    userText: string,
  ) => Promise<{ conversationId: number | null; consentNeeded: boolean }>;
}

export function useChat(deps: UseChatDeps): ChatState {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentRequest, setConsentRequest] = useState<ConsentRequest | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Dismiss pending approval cards when mode resets to normal
  useEffect(() => {
    if (deps.searchMode === 'normal') {
      setMessages((ms) =>
        ms.map((x) =>
          x.searchStatus === 'awaiting_approval'
            ? { ...x, searchStatus: undefined }
            : x,
        ),
      );
    }
  }, [deps.searchMode]);

  async function processStreamFn(
    stream: AsyncGenerator<StreamEvent, void, void>,
    pendingId: string,
    userText: string,
    isFirstMessage: boolean,
    controller: AbortController,
  ): Promise<{ conversationId: number | null; consentNeeded: boolean }> {
    let newConversationId: number | null = null;
    let streamJobId: string | null = null;
    let consentNeeded = false;
    let consentArgs: { query: string; reason: string } | null = null;
    let deepPlanQueries: string[] = [];

    try {
      for await (const ev of stream) {
        if (ev.type === 'status') {
          if (ev.phase === 'summarising_previous') {
            flushSync(() => {
              setMessages((ms) =>
                ms.map((x) =>
                  x.id === pendingId
                    ? { ...x, toolStatus: ev.message || 'Preparing context...' }
                    : x,
                ),
              );
            });
          }
          continue;
        }
        if (ev.type === 'intent_classified') {
          setMessages((ms) =>
            ms.map((x) => (x.id === pendingId ? { ...x, intent: ev.intent } : x)),
          );
          continue;
        }
        if (ev.type === 'jobs_queued') {
          const label =
            ev.status === 'running'
              ? ev.message || (ev.tool === 'research' ? 'Research is running...' : 'Analysing sources...')
              : ev.message;
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    deepSearchStatus: 'waiting' as const,
                    deepSearchMessage: label,
                  }
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
          if (ev.queries?.length) deepPlanQueries = ev.queries;
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
        if (ev.type === 'deep_search_plan') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, model: 'deep_search_plan', searchStatus: 'awaiting_approval' as const }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'research_plan') {
          const planJson = JSON.stringify(ev.plan);
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? {
                    ...x,
                    model: 'research_plan',
                    searchStatus: 'awaiting_approval' as const,
                    searchContextText: planJson,
                  }
                : x,
            ),
          );
          continue;
        }
        if (ev.type === 'plan_approved') {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === pendingId
                ? { ...x, searchStatus: 'approved' as const }
                : x,
            ),
          );
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
          if (ev.topics?.length) {
            deps.setConversationTopics(ev.topics);
          }
          const notice: DisplayMessage = {
            id: uid(),
            role: 'system',
            status: 'system',
            content: ev.fallback
              ? `Trimmed ${ev.removed} earlier message${ev.removed === 1 ? '' : 's'} (truncation only)`
              : `Trimmed ${ev.removed} earlier message${ev.removed === 1 ? '' : 's'} (≈${ev.summary_chars.toLocaleString()} chars summarised)`,
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
              deps.setActiveId(newConversationId);
              listConversations().then((r) => deps.setConversations(r.conversations.filter((c) => !c.deleted_at))).catch(() => {});
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
          let hadContent = false;
          setMessages((ms) => {
            const pending = ms.find((x) => x.id === pendingId);
            hadContent = !!(pending && pending.content.length > 0);
            if (hadContent) {
              return ms.map((x) =>
                x.id === pendingId
                  ? { ...x, errorMessage: ev.message }
                  : x,
              );
            }
            return ms.map((x) =>
              x.id === pendingId
                ? { ...x, status: 'error', errorMessage: ev.message }
                : x,
            );
          });
          if (!hadContent) {
            clearActiveStream();
            break;
          }
        }
      }

      if (isFirstMessage && newConversationId != null && !consentNeeded) {
        deps.setActiveId(newConversationId);
      }
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError';
      const transient =
        isTransientNetworkError(err) && (deps.visIsHidden() || deps.visJustResumed());
      if (!aborted && !transient) {
        clearActiveStream();
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

  async function runChatStreamFn(
    body: Parameters<typeof chatStream>[0],
    pendingId: string,
    userText: string,
  ) {
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const stream = chatStream(body, controller.signal);
    return processStreamFn(stream, pendingId, userText, body.conversation_id == null, controller);
  }

  async function send(forcedText?: string, searchModeOverride?: 'deep' | 'deep_approved' | 'research' | 'research_approved') {
    if (deps.researchEnabled && !forcedText && !searchModeOverride) {
      return sendResearchFn();
    }
    const text = (forcedText ?? input).trim();
    if (!text || sending || !deps.model) return;

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
      responseStyle: deps.styleKey || undefined,
      sourceUserText: text,
    };
    setMessages((m) => {
      const cleared = !searchModeOverride
        ? m.map((x) =>
            x.searchStatus === 'awaiting_approval'
              ? { ...x, searchStatus: undefined }
              : x,
          )
        : m;
      return [...cleared, userMsg, pendingMsg];
    });
    if (!forcedText) setInput('');
    setSending(true);
    setError(null);

    const isFirstMessage = deps.activeId == null;

    try {
      await runChatStreamFn(
        {
          model: deps.model,
          message: text,
          conversation_id: deps.activeId ?? undefined,
          ...(isFirstMessage && deps.ragEnabled ? { rag_enabled: true } : {}),
          ...(isFirstMessage && deps.knowledgeEnabled ? { knowledge_enabled: true } : {}),
          ...(deps.searchSuppressed ? { search_enabled: false } : deps.alwaysAllowSearch ? { search_enabled: true } : {}),
          ...((searchModeOverride ?? deps.searchMode) !== 'normal' ? { search_mode: searchModeOverride ?? deps.searchMode } : {}),
          ...(deps.styleKey ? { response_style: deps.styleKey } : {}),
        },
        pendingId,
        text,
      );
    } finally {
      setSending(false);
    }
  }

  async function sendResearchFn() {
    const text = input.trim();
    if (!text || sending || !deps.model) return;

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
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const stream = researchStream(
        { model: deps.model, question: text, conversation_id: deps.activeId ?? undefined },
        controller.signal,
      );
      await processStreamFn(stream, pendingId, text, deps.activeId == null, controller);
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
      await runChatStreamFn(
        {
          model: deps.model,
          message: pendingUserText,
          conversation_id: deps.activeId ?? undefined,
          ...(allow ? { search_enabled: true } : { search_consent_declined: true }),
          ...(deps.styleKey ? { response_style: deps.styleKey } : {}),
        },
        pendingAssistantId,
        pendingUserText,
      );
    } finally {
      setSending(false);
    }
  }

  return {
    messages, setMessages,
    sending, setSending,
    error, setError,
    input, setInput,
    consentRequest, setConsentRequest,
    streamAbortRef,
    send,
    sendResearch: sendResearchFn,
    resolveConsent,
    processStream: processStreamFn,
    runChatStream: runChatStreamFn,
  };
}
