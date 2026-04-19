import { useEffect, useRef, useState } from 'react';
import { getQueueActive } from '../api/queue/getQueueActive';
import type { QueueActive } from '../api/types/QueueActive';
import type { QueueEvent } from '../api/types/QueueEvent';
import { gatewayUrl } from '../lib/runtime-env';

export function useQueueStatus() {
  const [status, setStatus] = useState<QueueActive | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchActive() {
      try {
        const s = await getQueueActive();
        if (active) setStatus(s);
      } catch {}
    }

    void fetchActive();

    function connect() {
      const es = new EventSource(`${gatewayUrl()}/api/tool-queue/events`, { withCredentials: true });
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          if (ev.type) void fetchActive();
        } catch {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after a short delay
        if (active) {
          setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return status;
}
