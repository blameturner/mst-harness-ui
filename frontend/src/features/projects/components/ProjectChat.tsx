import { useEffect, useRef, useState } from 'react';
import { gatewayUrl } from '../../../lib/runtime-env';
import { defaultOrgId } from '../../../api/home/config';
import { projectChat } from '../../../api/projects/projects';
import { Btn } from '../../../components/ui/Btn';
import type { PendingPrompt } from '../quickFix';

type Mode = 'chat' | 'plan' | 'apply' | 'review' | 'explain' | 'decide' | 'scaffold';
const MODES: Mode[] = ['chat', 'plan', 'apply', 'review', 'explain', 'decide', 'scaffold'];

interface ChatLine {
  role: 'user' | 'assistant' | 'event';
  text: string;
  meta?: Record<string, unknown>;
}

export function ProjectChat({
  projectId, onFileChange, pendingPrompt, onPromptConsumed,
}: {
  projectId: number;
  onFileChange: (path: string) => void;
  pendingPrompt?: PendingPrompt | null;
  onPromptConsumed?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('chat');
  const [interactive, setInteractive] = useState(false);
  const [model, setModel] = useState('code');
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState<number | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  const autoSendRef = useRef(false);
  useEffect(() => {
    if (!pendingPrompt) return;
    setMode(pendingPrompt.mode);
    setInput(pendingPrompt.message);
    autoSendRef.current = !!pendingPrompt.autoSend;
    onPromptConsumed?.();
  }, [pendingPrompt, onPromptConsumed]);

  useEffect(() => {
    if (autoSendRef.current && input.trim() && !busy) {
      autoSendRef.current = false;
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function append(line: ChatLine) {
    setLines((prev) => [...prev, line]);
  }

  async function send() {
    if (!input.trim() || busy) return;
    const message = input.trim();
    setInput('');
    append({ role: 'user', text: message });
    setBusy(true);
    try {
      const { job_id } = await projectChat(projectId, {
        model, message, mode,
        conversation_id: convId ?? undefined,
        interactive_fs: interactive,
      });
      const url = `${gatewayUrl()}/api/projects/${projectId}/chat/stream/${encodeURIComponent(job_id)}?org_id=${defaultOrgId()}`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;
      let assistantText = '';
      append({ role: 'assistant', text: '' });
      es.onmessage = (e) => {
        if (e.data === '[DONE]') {
          es.close();
          setBusy(false);
          return;
        }
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'chunk' && ev.text) {
            assistantText += ev.text;
            setLines((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: 'assistant', text: assistantText };
              return copy;
            });
          } else if (ev.type === 'meta' && ev.conversation_id) {
            setConvId(ev.conversation_id);
          } else if (ev.type === 'file_changed' || ev.type === 'workspace_changed') {
            const changes = ev.changes || [{ path: ev.path, mode: ev.mode, version: ev.version }];
            for (const ch of changes) {
              if (ch?.path) {
                append({
                  role: 'event',
                  text: `${ch.mode || 'changed'} · ${ch.path}${ch.version ? ` v${ch.version}` : ''}`,
                });
                onFileChange(ch.path);
              }
            }
          } else if (ev.type === 'permission_request') {
            append({ role: 'event', text: `permission requested · ${ev.path} — ${ev.reason}` });
          } else if (ev.type === 'tool_result') {
            append({ role: 'event', text: `${ev.tool} ${ev.ok ? 'ok' : 'fail'}` });
          } else if (ev.type === 'error') {
            append({ role: 'event', text: `error · ${ev.message}` });
          } else if (ev.type === 'done') {
            es.close();
            setBusy(false);
          }
        } catch {
          // swallow malformed events
        }
      };
      es.onerror = () => {
        es.close();
        setBusy(false);
      };
    } catch (err: unknown) {
      append({ role: 'event', text: `error · ${err instanceof Error ? err.message : String(err)}` });
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-bg/80 backdrop-blur">
        <div className="flex items-center gap-1.5 px-3 py-2">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors',
                m === mode ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-panelHi',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-20 rounded-sm border border-border bg-bg px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-fg"
            />
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans cursor-pointer">
              <input
                type="checkbox"
                checked={interactive}
                onChange={(e) => setInteractive(e.target.checked)}
                className="accent-fg"
              />
              Interactive fs
            </label>
          </div>
          {convId && (
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-mono">
              conv #{convId}
            </span>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto px-3 py-3">
        {lines.length === 0 && (
          <p className="px-3 py-12 text-center text-[11px] uppercase tracking-[0.18em] text-muted font-sans">
            Waiting for your first message
          </p>
        )}
        {lines.map((l, i) => (
          <ChatLineView key={i} line={l} busy={busy && i === lines.length - 1 && l.role === 'assistant'} />
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-bg p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message — ⌘↵ to send"
          rows={3}
          disabled={busy}
          className="w-full resize-none rounded-md border border-border bg-bg p-2 text-xs font-sans placeholder:text-muted focus:outline-none focus:border-fg disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
            mode · <span className="text-fg">{mode}</span>
            {interactive && <span className="ml-1.5 text-fg">+ tools</span>}
          </span>
          <Btn variant="primary" size="sm" disabled={busy || !input.trim()} onClick={() => void send()}>
            {busy ? 'Sending…' : 'Send'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ChatLineView({ line, busy }: { line: ChatLine; busy: boolean }) {
  if (line.role === 'event') {
    return (
      <div className="flex items-center gap-2 pl-1">
        <span className="h-px w-3 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">{line.text}</span>
      </div>
    );
  }
  const isUser = line.role === 'user';
  return (
    <article
      className={[
        'rounded-md px-3 py-2 text-xs leading-relaxed font-sans animate-fadeIn',
        isUser ? 'bg-fg text-bg ml-6' : 'bg-panel border border-border text-fg mr-6',
      ].join(' ')}
    >
      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] opacity-70">
        {isUser ? 'You' : 'Agent'}
      </p>
      <div className={`whitespace-pre-wrap break-words ${busy ? 'caret' : ''}`}>
        {line.text || (busy ? '' : <em className="opacity-60">(empty)</em>)}
      </div>
    </article>
  );
}
