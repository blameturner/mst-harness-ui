import type { HarnessStats } from '../../../../api/types/HarnessStats';
import { formatNumber } from '../../../../lib/utils/formatNumber';

export function DailyChart({ days }: { days: HarnessStats['by_day'] }) {
  const max = Math.max(...days.map((d) => d.requests), 1);
  return (
    <div>
      <div className="flex items-end gap-px h-40 border-b border-border">
        {days.map((d) => {
          const errPct = d.errors > 0 && d.requests > 0 ? (d.errors / d.requests) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {errPct > 0 && (
                <div
                  className="w-full bg-red-400/70 rounded-t-sm"
                  style={{ height: `${(d.errors / max) * 100}%` }}
                />
              )}
              <div
                className="w-full bg-fg/80 min-h-[2px] transition-all group-hover:bg-fg"
                style={{ height: `${((d.requests - d.errors) / max) * 100}%` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-fg text-bg text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.date}: {d.requests} req{d.errors > 0 ? ` · ${d.errors} err` : ''} · {formatNumber(d.tokens_input)} in
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-muted">{days[0]?.date ?? ''}</span>
        <span className="text-[9px] font-mono text-muted">{days[days.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}
