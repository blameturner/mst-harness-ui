import { useEffect, useState } from 'react';
import { getQueueActive } from '../api/queue/getQueueActive';
import type { QueueActive } from '../api/types/QueueActive';

const POLL_INTERVAL = 15_000;

export function useQueueStatus() {
  const [status, setStatus] = useState<QueueActive | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const s = await getQueueActive();
        if (active) setStatus(s);
      } catch {}
    }

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return status;
}
