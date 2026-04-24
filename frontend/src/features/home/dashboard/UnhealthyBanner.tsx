// frontend/src/features/home/dashboard/UnhealthyBanner.tsx
import type { HomeHealth } from '../../../api/home/types';

interface Props { health: HomeHealth | null }

function problems(h: HomeHealth): string[] {
  const out: string[] = [];
  if (!h.scheduler_running) out.push('scheduler not running');
  const missing = Object.entries(h.tables)
    .filter(([k, v]) => !v && k !== 'digest_feedback')
    .map(([k]) => k);
  if (missing.length) out.push(`missing tables: ${missing.join(', ')}`);
  return out;
}

export function UnhealthyBanner({ health }: Props) {
  if (!health) return null;
  const ps = problems(health);
  if (ps.length === 0) return null;
  return (
    <div className="border-t-2 border-b-2 border-fg bg-panel/60 px-4 sm:px-8 py-2.5">
      <p className="font-display italic text-[13px] sm:text-[14px] text-fg">
        <span className="mr-2 not-italic font-sans text-[11px] tracking-[0.18em] uppercase">§</span>
        Stop press — {ps.join(' · ')}.
      </p>
    </div>
  );
}
