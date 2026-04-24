import { forwardRef, useState } from 'react';
import type { Question } from '../../../api/home/types';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  q: Question;
  onAnswer: (q: Question, selectedOption: string, answerText: string) => void;
  onDismiss: (q: Question) => void;
}

export const QuestionCard = forwardRef<HTMLDivElement, Props>(function QuestionCard(
  { q, onAnswer, onDismiss },
  ref,
) {
  const [freeText, setFreeText] = useState('');

  return (
    <div ref={ref} className="relative pl-4 sm:pl-5 py-4 pr-2">
      <span className="absolute left-0 top-4 bottom-4 w-[2px] bg-fg" aria-hidden />

      <p className="font-display italic text-[19px] sm:text-[20px] leading-snug text-fg">
        {q.question_text}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {q.suggested_options.map((opt, i) => {
          const letter = String.fromCharCode(97 + i);
          return (
            <button
              key={opt.value}
              data-question-option={q.id}
              className="group inline-flex items-baseline gap-1.5 border border-border px-2.5 py-1 text-[12px] font-sans hover:border-fg hover:bg-panel/60 transition-colors"
              onClick={() => onAnswer(q, opt.value, opt.label)}
            >
              <span className="font-display italic text-muted group-hover:text-fg text-[11px]">
                {letter}.
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Or type a custom answer…"
          className="flex-1 bg-transparent border-b border-border px-0 py-1 text-[13px] font-sans outline-none focus:border-fg placeholder:text-muted/60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && freeText.trim()) onAnswer(q, '', freeText.trim());
          }}
        />
        <button
          className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted hover:text-fg"
          onClick={() => onDismiss(q)}
        >
          Dismiss
        </button>
      </div>

      <div className="mt-2 text-[11px] text-muted font-sans">
        <span className="italic font-display">filed</span>{' '}
        <span>{formatRelative(q.created_at)}</span>
      </div>
    </div>
  );
});
