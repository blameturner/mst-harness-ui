import { useEffect, useState } from 'react';
import { getDigest } from '../../../../api/home/digest';
import { postDigestFeedback } from '../../../../api/home/mutations';
import type { DigestMeta } from '../../../../api/home/types';
import { useToast } from '../../../../lib/toast/useToast';
import { MarkdownBody } from '../../../../components/chat/MarkdownBody';
import { ModalShell } from './ModalShell';

interface Props {
  date?: string;
  onClose: () => void;
}

export function DigestModal({ date, onClose }: Props) {
  const [digest, setDigest] = useState<DigestMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    getDigest({ date })
      .then((d) => setDigest(d))
      .finally(() => setLoading(false));
  }, [date]);

  async function sendFeedback(signal: 'up' | 'down') {
    if (!digest) return;
    const res = await postDigestFeedback({ digestId: digest.id, signal });
    if (res.ok) toast.success('Feedback saved');
    else if (res.notConfigured) toast.info('Feedback storage not configured yet');
    else toast.error('Feedback failed');
  }

  return (
    <ModalShell title={digest ? `Digest — ${digest.date}` : 'Digest'} onClose={onClose}>
      {loading && <div className="text-sm text-muted italic font-display">Loading…</div>}
      {!loading && !digest && (
        <div className="text-sm text-muted italic font-display">No digest for this date.</div>
      )}
      {digest && (
        <>
          <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="tabular-nums">{digest.cluster_count} clusters</span>
            <span>·</span>
            <span className="tabular-nums">{digest.source_count} sources</span>
            <span className="ml-auto flex gap-1">
              <button
                className="border border-border px-2 py-0.5 hover:border-fg"
                onClick={() => void sendFeedback('up')}
                aria-label="Useful"
              >
                👍
              </button>
              <button
                className="border border-border px-2 py-0.5 hover:border-fg"
                onClick={() => void sendFeedback('down')}
                aria-label="Not useful"
              >
                👎
              </button>
            </span>
          </div>
          {digest.markdown ? (
            <MarkdownBody content={digest.markdown} />
          ) : (
            <div className="italic font-display text-muted">No body recorded.</div>
          )}
        </>
      )}
    </ModalShell>
  );
}
