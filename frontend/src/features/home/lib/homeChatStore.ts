// A module-level store for Home chat state + in-flight SSE handles.
//
// Why this exists: SSE subscriptions used to live inside useHomeChat's
// component state, which meant every time DashboardTab unmounted — including
// navigating away from /home — the effect cleanup closed the EventSource and
// the user lost the live stream. The harness job keeps running on the backend,
// but the UI goes dark until the next full refresh.
//
// With this store, handles are module-scoped. React components subscribe
// through useSyncExternalStore and get re-renders on every state change, but
// the handles themselves outlive any component lifecycle. Navigate to /code,
// come back, the chunks that landed in the meantime are already in state and
// the stream is still flowing.

import { subscribeJob, type SubscribeJobHandle } from '../../../lib/sse/subscribeJob';

export interface HomeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  model?: string | null;
}

export interface HomeChatStoreSnapshot {
  messages: HomeChatMessage[];
  conversationId: number | null;
  /** True while any assistant message is still receiving chunks. */
  streaming: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();
const handles = new Map<string, SubscribeJobHandle>(); // jobId → SSE handle
let messages: HomeChatMessage[] = [];
let conversationId: number | null = null;

// Snapshot is re-derived on every state change so useSyncExternalStore's
// identity check triggers a re-render.
let snapshot: HomeChatStoreSnapshot = deriveSnapshot();

function deriveSnapshot(): HomeChatStoreSnapshot {
  return {
    messages,
    conversationId,
    streaming: messages.some((m) => m.streaming),
  };
}

function emit() {
  snapshot = deriveSnapshot();
  listeners.forEach((l) => l());
}

export const homeChatStore = {
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  getSnapshot(): HomeChatStoreSnapshot {
    return snapshot;
  },

  setConversationId(id: number | null): void {
    if (conversationId === id) return;
    conversationId = id;
    // Reset message state when the underlying conversation changes — but keep
    // any in-flight streamed messages (they belong to whoever kicked them off).
    messages = messages.filter((m) => m.streaming);
    emit();
  },

  /** Replace history rows from the server while preserving live streams. */
  seedFromServer(rows: HomeChatMessage[]): void {
    const seededIds = new Set(rows.map((m) => m.id));
    const live = messages.filter(
      (m) => m.streaming || (!m.id.startsWith('h-') && !seededIds.has(m.id)),
    );
    messages = [...rows, ...live];
    emit();
  },

  addUserMessage(text: string): string {
    const id = `u-${Date.now()}`;
    messages = [...messages, { id, role: 'user', text }];
    emit();
    return id;
  },

  /**
   * Begin streaming from a harness job. Idempotent — if the same jobId is
   * already being consumed (e.g. a component remounted and tried to attach
   * again), this no-ops.
   */
  attachStream(jobId: string): void {
    const localId = `a-${jobId}`;
    if (handles.has(jobId)) return;

    // Seed a placeholder so the UI shows a streaming bubble immediately.
    if (!messages.some((m) => m.id === localId)) {
      messages = [
        ...messages,
        { id: localId, role: 'assistant', text: '', streaming: true },
      ];
      emit();
    }

    const handle = subscribeJob(jobId, (ev) => {
      if (ev.type === 'chunk') {
        messages = messages.map((m) =>
          m.id === localId ? { ...m, text: m.text + ev.text } : m,
        );
        emit();
        return;
      }
      if (ev.type === 'error') {
        messages = messages.map((m) =>
          m.id === localId
            ? { ...m, streaming: false, text: `${m.text}\n\n[error: ${ev.message}]` }
            : m,
        );
        handles.delete(jobId);
        emit();
        return;
      }
      if (ev.type === 'done') {
        messages = messages.map((m) =>
          m.id === localId ? { ...m, streaming: false } : m,
        );
        handles.delete(jobId);
        emit();
      }
    });

    handles.set(jobId, handle);
  },

  /** Stop every live stream. Nothing in the app should call this except on logout. */
  disposeAll(): void {
    handles.forEach((h) => h.close());
    handles.clear();
    messages = messages.map((m) => (m.streaming ? { ...m, streaming: false } : m));
    emit();
  },
};
