import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import type { PlannedSearchState } from '../../../lib/plannedSearch/types';
import { approvePlannedSearch } from '../../../api/planned_search/approvePlannedSearch';
import { rejectPlannedSearch } from '../../../api/planned_search/rejectPlannedSearch';
import { getPlannedSearch } from '../../../api/planned_search/getPlannedSearch';

const POLL_INTERVAL_MS = 3_000;
const POLL_START_DELAY_MS = 5_000;

interface Deps {
  message: DisplayMessage;
  patchMessage: (id: string, patch: Partial<DisplayMessage>) => void;
  orgId: number | null;
  onApproved: () => void;
  onRejected: () => void;
}

export function usePlannedSearchApproval({
  message,
  patchMessage,
  orgId,
  onApproved,
  onRejected,
}: Deps) {
  const current = message.plannedSearch;
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const [working, setWorking] = useState(false);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (pollStartTimerRef.current) {
      clearTimeout(pollStartTimerRef.current);
      pollStartTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const patchPlanned = useCallback(
    (patch: Partial<PlannedSearchState>) => {
      if (!current) return;
      patchMessage(message.id, {
        plannedSearch: { ...current, ...patch },
      });
    },
    [current, message.id, patchMessage],
  );

  const poll = useCallback(async () => {
    if (!current) return;
    try {
      const res = await getPlannedSearch(current.proposalMessageId);
      if (cancelledRef.current) return;
      const backendStatus = res.message.search_status;
      if (backendStatus === 'completed') {
        patchPlanned({ status: 'completed' });
        stopPolling();
        onApproved();
        return;
      }
      if (backendStatus === 'declined' || backendStatus === 'failed') {
        patchPlanned({
          status: backendStatus === 'failed' ? 'error' : 'rejected',
          errorMessage: backendStatus === 'failed' ? 'Search failed on the server' : undefined,
        });
        stopPolling();
        if (backendStatus === 'declined') onRejected();
        return;
      }
    } catch {
      if (cancelledRef.current) return;
    }
    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [current, patchPlanned, stopPolling, onApproved, onRejected]);

  const approve = useCallback(async () => {
    if (!current || working) return;
    if (orgId == null) {
      patchPlanned({ status: 'error', errorMessage: 'Waiting for organisation context' });
      return;
    }
    setWorking(true);
    cancelledRef.current = false;
    patchPlanned({ status: 'submitting', errorMessage: undefined });

    pollStartTimerRef.current = setTimeout(() => {
      patchPlanned({ status: 'synthesising' });
      void poll();
    }, POLL_START_DELAY_MS);

    try {
      const res = await approvePlannedSearch(current.proposalMessageId, orgId);
      if (cancelledRef.current) return;
      stopPolling();
      patchPlanned({
        status: 'completed',
        answerMessageId: res.answer_message_id,
      });
      onApproved();
    } catch (err) {
      if (cancelledRef.current) return;
      stopPolling();
      const msg = (err as Error)?.message ?? 'Approval failed';
      patchPlanned({ status: 'error', errorMessage: msg });
    } finally {
      setWorking(false);
    }
  }, [current, working, orgId, patchPlanned, poll, stopPolling, onApproved]);

  const reject = useCallback(async () => {
    if (!current || working) return;
    setWorking(true);
    try {
      await rejectPlannedSearch(current.proposalMessageId);
      patchPlanned({ status: 'rejected' });
      onRejected();
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Reject failed';
      patchPlanned({ status: 'error', errorMessage: msg });
    } finally {
      setWorking(false);
    }
  }, [current, working, patchPlanned, onRejected]);

  return { approve, reject };
}
