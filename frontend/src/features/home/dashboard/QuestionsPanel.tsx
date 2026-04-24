import { useMemo, useState } from 'react';
import type { Question } from '../../../api/home/types';
import { answerQuestion, dismissQuestion } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { QuestionCard } from './QuestionCard';

interface Props {
  questions: Question[];
  onRefetch: () => void;
  onChatStream: (jobId: string) => void;
  registerScrollTarget?: (id: number, el: HTMLDivElement | null) => void;
}

export function QuestionsPanel({
  questions,
  onRefetch,
  onChatStream,
  registerScrollTarget,
}: Props) {
  const toast = useToast();
  const [optimisticallyHidden, setOptimisticallyHidden] = useState<Set<number>>(new Set());

  const visibleQuestions = useMemo(
    () => questions.filter((q) => !optimisticallyHidden.has(q.id)),
    [optimisticallyHidden, questions],
  );

  async function handleAnswer(q: Question, selectedOption: string, answerText: string) {
    setOptimisticallyHidden((s) => new Set(s).add(q.id));
    try {
      const { job_id } = await answerQuestion({
        id: q.id,
        selectedOption,
        answerText,
      });
      onChatStream(job_id);
      toast.success('Answer sent');
      onRefetch();
    } catch (err) {
      setOptimisticallyHidden((s) => {
        const next = new Set(s);
        next.delete(q.id);
        return next;
      });
      toast.error(`Answer failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleDismiss(q: Question) {
    setOptimisticallyHidden((s) => new Set(s).add(q.id));
    try {
      await dismissQuestion({ id: q.id });
      toast.info('Question dismissed');
      onRefetch();
    } catch (err) {
      setOptimisticallyHidden((s) => {
        const next = new Set(s);
        next.delete(q.id);
        return next;
      });
      toast.error(`Dismiss failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const Header = (
    <div className="flex items-baseline gap-2 pb-1">
      <span className="text-[10px] uppercase tracking-[0.22em] font-sans text-muted">
        Queries Awaiting Attention
        {visibleQuestions.length > 0 && (
          <span className="ml-2 font-display not-italic tabular-nums">
            · {visibleQuestions.length}
          </span>
        )}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  if (visibleQuestions.length === 0) {
    return (
      <div>
        {Header}
        <div className="py-10 text-center">
          <p className="font-display italic text-lg text-muted">Quiet morning.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {Header}
      <div className="divide-y divide-border">
        {visibleQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            ref={(el) => registerScrollTarget?.(q.id, el)}
            onAnswer={handleAnswer}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}


