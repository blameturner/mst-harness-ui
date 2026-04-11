import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogLine } from '../../../api/types/LogLine';
import { getLogStreamUrl } from '../../../api/logs/getLogStreamUrl';
import { MAX_LOG_LINES } from '../constants/MAX_LOG_LINES';
import type { StoredLine } from '../types/StoredLine';

interface UseLogStreamArgs {
  paused: boolean;
}

interface UseLogStreamResult {
  lines: StoredLine[];
  connected: boolean;
  error: string | null;
  flushBuffer: () => void;
  clearLines: () => void;
}

export function useLogStream({ paused }: UseLogStreamArgs): UseLogStreamResult {
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pausedRef = useRef(paused);
  const bufferRef = useRef<StoredLine[]>([]);
  const keyRef = useRef(0);

  pausedRef.current = paused;

  useEffect(() => {
    const url = getLogStreamUrl({ since: 120, tail: 200 });
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    function connect() {
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => {
        failCount = 0;
        setConnected(true);
        setError(null);
      };

      es.onmessage = (ev) => {
        try {
          const parsed: LogLine = JSON.parse(ev.data);
          const stored: StoredLine = { ...parsed, key: keyRef.current++ };

          if (pausedRef.current) {
            bufferRef.current.push(stored);
            if (bufferRef.current.length > MAX_LOG_LINES) {
              bufferRef.current = bufferRef.current.slice(-MAX_LOG_LINES);
            }
            return;
          }

          setLines((prev) => {
            const next = [...prev, stored];
            return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
          });
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        failCount++;
        if (failCount >= 5) {
          setError('Cannot connect to log stream. Is the Docker socket mounted?');
          return;
        }
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const flushBuffer = useCallback(() => {
    const buffered = bufferRef.current;
    bufferRef.current = [];
    if (buffered.length > 0) {
      setLines((prev) => {
        const merged = [...prev, ...buffered];
        return merged.length > MAX_LOG_LINES ? merged.slice(-MAX_LOG_LINES) : merged;
      });
    }
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
    bufferRef.current = [];
  }, []);

  return { lines, connected, error, flushBuffer, clearLines };
}
