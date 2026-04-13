import { useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { CodeConversation } from '../../../api/types/CodeConversation';
import type { CodeMessage } from '../types/CodeMessage';
import type { AttachedFile } from '../types/AttachedFile';
import { getCodeMessages } from '../../../api/code/getCodeMessages';
import { getCodeWorkspace } from '../../../api/code/getCodeWorkspace';
import { replayStream } from '../../../api/replayStream';
import { hydrateCodeMessages } from '../utils/hydrateCodeMessages';
import { utf8ToB64 } from '../utils/utf8ToB64';
import { labelForTool } from '../../../lib/intent/labelForTool';

export interface SessionResumeState {
  autoResumeTriedRef: React.MutableRefObject<boolean>;
  resumeCodeStream: (
    c: CodeConversation,
    jobId: string,
    onSetConversationId: (id: number) => void,
    onSetMode: (m: any) => void,
    onSetModel: (m: string) => void,
    onSetMessages: React.Dispatch<React.SetStateAction<CodeMessage[]>>,
    onSetError: (e: string | null) => void,
    onSetSending: (s: boolean) => void,
    onSetFiles: (files: AttachedFile[]) => void,
    onRememberActiveSession: (id: number | null, jobId?: string) => void,
    onScheduleRetry: (convId: number, callback: () => Promise<void>) => void,
    onRefreshSessions: () => Promise<void>,
    streamAbortRef: React.MutableRefObject<AbortController | null>,
    setChecklist: (items: string[]) => void,
    setChecked: (checked: Record<number, boolean>) => void,
  ) => Promise<void>;
}

export function useSessionResume(): SessionResumeState {
  const autoResumeTriedRef = useRef(false);

  const resumeCodeStream = useCallback(
    async (
      c: CodeConversation,
      jobId: string,
      onSetConversationId: (id: number) => void,
      onSetMode: (m: any) => void,
      onSetModel: (m: string) => void,
      onSetMessages: React.Dispatch<React.SetStateAction<CodeMessage[]>>,
      onSetError: (e: string | null) => void,
      onSetSending: (s: boolean) => void,
      onSetFiles: (files: AttachedFile[]) => void,
      onRememberActiveSession: (id: number | null, jobId?: string) => void,
      onScheduleRetry: (convId: number, callback: () => Promise<void>) => void,
      onRefreshSessions: () => Promise<void>,
      streamAbortRef: React.MutableRefObject<AbortController | null>,
      setChecklist: (items: string[]) => void,
      setChecked: (checked: Record<number, boolean>) => void,
    ): Promise<void> => {
      onSetConversationId(c.Id);
      if (c.mode) onSetMode(c.mode);
      if (c.model) onSetModel(c.model);
      onSetError(null);

      let msgRes: Awaited<ReturnType<typeof getCodeMessages>>;
      let ws: Awaited<ReturnType<typeof getCodeWorkspace>>;
      try {
        [msgRes, ws] = await Promise.all([
          getCodeMessages(c.Id),
          getCodeWorkspace(c.Id),
        ]);
      } catch {
        onRememberActiveSession(null);
        return;
      }

      const loaded = hydrateCodeMessages(msgRes.messages);
      const convStatus = msgRes.conversation?.status;

      const hydrated: AttachedFile[] = (ws.files ?? []).map((f) => ({
        name: f.name,
        content: f.content,
        content_b64: utf8ToB64(f.content),
        size: f.content.length,
      }));
      onSetFiles(hydrated);

      if (convStatus !== 'processing') {
        onRememberActiveSession(null);
        if (convStatus === 'error') {
          onSetMessages(loaded);
          onSetError('The model encountered an error processing this session.');
        } else {
          onSetMessages(loaded);
        }
        return;
      }

      const pendingId = `resume-${c.Id}`;
      onSetMessages([
        ...loaded,
        {
          id: pendingId,
          role: 'assistant',
          mode: c.mode ?? 'plan',
          content: '',
          status: 'streaming',
          reconnecting: true,
        } as any,
      ]);

      const controller = new AbortController();
      streamAbortRef.current = controller;
      onSetSending(true);

      let replayWorked = false;
      try {
        const stream = replayStream(jobId, controller.signal);
        const first = await stream.next();

        if (!first.done) {
          replayWorked = true;
          onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
            ms.map((x: CodeMessage): CodeMessage => x.id === pendingId ? { ...x, reconnecting: false } : x),
          );

          async function* prependFirst(
            firstVal: any,
            rest: AsyncGenerator<any, void, void>,
          ): AsyncGenerator<any, void, void> {
            yield firstVal;
            yield* rest;
          }

          for await (const ev of prependFirst(first.value, stream)) {
            if (ev.type === 'chunk') {
              onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                ms.map((x: CodeMessage): CodeMessage =>
                  x.id === pendingId
                    ? {
                        ...x,
                        content: x.content + ev.text,
                        ...(x.isThinking ? { isThinking: false, thinkingEndTime: Date.now() } : {}),
                      }
                    : x,
                ),
              );
            } else if (ev.type === 'thinking') {
              onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                ms.map((x: CodeMessage): CodeMessage =>
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
            } else if (ev.type === 'tool_status') {
              const label =
                ev.phase === 'planning'
                  ? ev.summary || 'Planning tools…'
                  : ev.phase === 'start'
                  ? `${labelForTool(ev.tool)}…`
                  : undefined;
              flushSync(() => {
                onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                  ms.map((x: CodeMessage): CodeMessage => (x.id === pendingId ? { ...x, toolStatus: label } : x)),
                );
              });
            } else if (ev.type === 'plan_checklist') {
              setChecklist(ev.steps ?? []);
              setChecked({});
            } else if (ev.type === 'done') {
              onRememberActiveSession(null);
              onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                ms.map((x: CodeMessage): CodeMessage => (x.id === pendingId ? { ...x, status: 'complete', isThinking: false } : x)),
              );
            } else if (ev.type === 'error') {
              onRememberActiveSession(null);
              onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                ms.map((x: CodeMessage): CodeMessage =>
                  x.id === pendingId ? { ...x, status: 'error', errorMessage: ev.message } : x,
                ),
              );
              onSetError(ev.message);
              break;
            }
          }
        }
      } catch {
        // Replay failed, fall through to DB polling
      }

      if (!replayWorked) {
        onRememberActiveSession(null);
        const hasAssistantReply = msgRes.messages.some(
          (m) => m.role === 'assistant' && m.content && m.content.length > 0,
        );
        if (hasAssistantReply) {
          onSetMessages(hydrateCodeMessages(msgRes.messages));
          onSetSending(false);
        } else {
          onSetSending(false);
          await onScheduleRetry(c.Id, async () => {
            const res = await getCodeMessages(c.Id);
            if (res.conversation?.status === 'processing') {
              onSetMessages((ms: CodeMessage[]): CodeMessage[] =>
                ms.map((x: CodeMessage): CodeMessage =>
                  x.id === pendingId ? { ...x, reconnecting: false } : x,
                ),
              );
              await onScheduleRetry(c.Id, async () => {});
            } else {
              onSetMessages(hydrateCodeMessages(res.messages));
            }
          });
        }
        return;
      }

      onSetSending(false);
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      await onRefreshSessions();
    },
    [],
  );

  return {
    autoResumeTriedRef,
    resumeCodeStream,
  };
}

