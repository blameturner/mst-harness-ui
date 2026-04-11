import { Fragment } from 'react';
import type { HarnessStats } from '../../../api/types/HarnessStats';
import { DAY_LABELS } from '../constants/DAY_LABELS';

export function Heatmap({ data }: { data: HarnessStats['by_hour'] }) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const d of data) {
    if (d.day_of_week >= 0 && d.day_of_week < 7 && d.hour >= 0 && d.hour < 24) {
      grid[d.day_of_week][d.hour] = d.requests;
    }
  }
  const max = Math.max(...data.map((d) => d.requests), 1);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `3rem repeat(24, 1fr)` }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[8px] font-mono text-muted text-center py-1">
            {h.toString().padStart(2, '0')}
          </div>
        ))}
        {grid.map((row, dayIdx) => (
          <Fragment key={`row-${dayIdx}`}>
            <div className="text-[9px] font-sans text-muted flex items-center pr-2 justify-end">
              {DAY_LABELS[dayIdx]}
            </div>
            {row.map((count, hourIdx) => {
              const intensity = count / max;
              return (
                <div
                  key={`${dayIdx}-${hourIdx}`}
                  className="w-5 h-5 rounded-sm group relative"
                  style={{ backgroundColor: intensity > 0 ? `rgba(10, 10, 10, ${0.08 + intensity * 0.82})` : 'rgba(10, 10, 10, 0.04)' }}
                  title={`${DAY_LABELS[dayIdx]} ${hourIdx}:00 — ${count} requests`}
                >
                  {count > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-fg text-bg text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {count} req
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
