import { useState } from 'react';

interface Props {
  reason: string;
  onRun: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

const BUBBLE_MAX = 'max-w-[92%] md:max-w-[80%]';

export function SearchConsentPrompt({ reason, onRun, onSkip }: Props) {
  const [pending, setPending] = useState<'run' | 'skip' | null>(null);

  async function handle(which: 'run' | 'skip', fn: () => void | Promise<void>) {
    if (pending) return;
    setPending(which);
    try {
      await fn();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className={`${BUBBLE_MAX} px-5 py-4 rounded-2xl rounded-bl-sm bg-panel border border-border text-fg`}>
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-lg leading-none">🔎</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug">{reason}</p>
            <p className="text-[11px] text-muted font-sans mt-1">
              This may take 10–30 seconds.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void handle('run', onRun)}
                className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md bg-fg text-bg hover:bg-fg/85 transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {pending === 'run' && <Spinner />}
                Run web search
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void handle('skip', onSkip)}
                className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-border text-fg hover:bg-panelHi transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {pending === 'skip' && <Spinner />}
                Skip search
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 border-[1.5px] border-current border-r-transparent rounded-full animate-spin"
    />
  );
}
