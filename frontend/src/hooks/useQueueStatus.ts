import { useEffect, useState } from 'react';
import { getQueueStatus } from '../api/queue/getQueueStatus';
import type { QueueStatus } from '../api/types/QueueStatus';

const POLL_INTERVAL = 15_000;

export function useQueueStatus() {
  const [status, setStatus] = useState<QueueStatus | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const s = await getQueueStatus();
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
