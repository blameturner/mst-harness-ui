import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getInsight,
  listInsightResearch,
  requestInsightResearch,
} from '../../../../api/home/insights';
import type {
  Insight,
  InsightResearchPlan,
  InsightResearchStatus,
} from '../../../../api/home/types';
import { formatRelative } from '../../../../lib/utils/formatRelative';
import { useToast } from '../../../../lib/toast/useToast';
import { MarkdownBody } from '../../../../components/chat/MarkdownBody';
import { ModalShell } from './ModalShell';

interface Props {
  id: number;
  onClose: () => void;
}

const ACTIVE_STATUSES: ReadonlySet<InsightResearchStatus> = new Set([
  'pending',
  'generating',
  'searching',
  'synthesizing',
]);

function statusLabel(s: InsightResearchStatus): string {
  switch (s) {
    case 'pending':
      return 'Pending';
    case 'generating':
      return 'Generating';
    case 'searching':
      return 'Searching';
    case 'synthesizing':
      return 'Synthesising';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
  }
}

function statusTone(s: InsightResearchStatus): string {
  if (s === 'completed') return 'text-fg border-fg';
  if (s === 'failed') return 'text-red-600 border-red-600/50';
  return 'text-muted border-border';
}

export function InsightModal({ id, onClose }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<InsightResearchPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [focus, setFocus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const previousCompletedIds = useRef<Set<number>>(new Set());

  const reloadInsight = useCallback(async () => {
    const fresh = await getInsight(id);
    setInsight(fresh);
  }, [id]);

  const reloadPlans = useCallback(async () => {
    try {
      const res = await listInsightResearch(id);
      setPlans(res.plans);
      return res.plans;
    } catch {
      return [];
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    getInsight(id)
      .then(setInsight)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setPlansLoading(true);
    reloadPlans().finally(() => setPlansLoading(false));
  }, [reloadPlans]);

  // Poll for plan status updates while any plan is still active.
  const hasActive = useMemo(
    () => plans.some((p) => ACTIVE_STATUSES.has(p.status)),
    [plans],
  );
  useEffect(() => {
    if (!hasActive) return;
    const iv = window.setInterval(() => {
      void reloadPlans().then((fresh) => {
        // If any plan just transitioned to completed, re-fetch the insight body
        // (the backend appends "## Follow-up: …" sections when plans complete).
        const newlyCompleted = fresh.filter(
          (p) => p.status === 'completed' && !previousCompletedIds.current.has(p.plan_id),
        );
        if (newlyCompleted.length > 0) {
          newlyCompleted.forEach((p) => previousCompletedIds.current.add(p.plan_id));
          void reloadInsight();
        }
      });
    }, 15_000);
    return () => window.clearInterval(iv);
  }, [hasActive, reloadPlans, reloadInsight]);

  // Seed previousCompletedIds from the initial load so we only react to
  // transitions, not every plan that was already complete when we opened.
  useEffect(() => {
    for (const p of plans) {
      if (p.status === 'completed') previousCompletedIds.current.add(p.plan_id);
    }
  }, [plans]);

  async function handleDigDeeper(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = focus.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await requestInsightResearch(id, trimmed);
      setFocus('');
      toast.success('Follow-up queued');
      await reloadPlans();
    } catch (err) {
      toast.error(
        `Couldn't queue: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={insight?.title || 'Insight'} onClose={onClose}>
      {loading && <div className="text-sm text-muted italic font-display">Loading…</div>}
      {insight && (
        <>
          <div className="mb-4 text-[11px] uppercase tracking-[0.14em] text-muted">
            <span>{insight.topic}</span>
            <span className="mx-1.5">·</span>
            <span>{insight.trigger.replace(/_/g, ' ')}</span>
            <span className="mx-1.5">·</span>
            <span>{formatRelative(insight.created_at)}</span>
          </div>

          <MarkdownBody content={insight.body_markdown} />

          {insight.sources.length > 0 && (
            <div className="mt-5 border-t border-border pt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted">
                Sources
              </div>
              <ul className="space-y-0.5 text-[12px]">
                {insight.sources.map((s, i) => (
                  <li key={`${s.url}-${i}`}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 decoration-border hover:decoration-fg"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              Dig deeper
            </div>
            <form onSubmit={handleDigDeeper} className="flex gap-2">
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="What should we look into next?"
                className="flex-1 border border-border bg-transparent px-3 py-2 text-[13px] outline-none focus:border-fg placeholder:text-muted/60"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !focus.trim()}
                className="border border-fg bg-fg text-bg px-3 py-2 text-[11px] uppercase tracking-[0.14em] disabled:opacity-50"
              >
                {submitting ? 'Queuing…' : 'Research'}
              </button>
            </form>

            {plansLoading && plans.length === 0 && (
              <div className="mt-3 text-[12px] text-muted italic font-display">
                Checking for follow-ups…
              </div>
            )}

            {plans.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {plans.map((p) => (
                  <li key={p.plan_id} className="flex items-center gap-3 py-2">
                    <span
                      className={[
                        'shrink-0 px-1.5 py-0.5 border text-[9px] uppercase tracking-[0.14em]',
                        statusTone(p.status),
                      ].join(' ')}
                    >
                      {statusLabel(p.status)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.focus}</span>
                    {p.confidence != null && (
                      <span className="shrink-0 text-[11px] text-muted tabular-nums">
                        {Math.round(p.confidence * 100)}%
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatRelative(p.updated_at ?? p.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}
