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
    <div className="border-b border-red-500 bg-red-500/10 px-8 py-2 text-[12px] text-red-400">
      Unhealthy — {ps.join(' · ')}
    </div>
  );
}
