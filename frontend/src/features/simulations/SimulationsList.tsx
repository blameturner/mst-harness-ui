import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  isSimTerminal,
  simulationsApi,
  type Sim,
} from '../../api/simulations';
import { Empty, StatusPill } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';
import { speakerColor } from './speakerColor';

interface Props {
  selectedId?: number | null;
  onEmptyChange?: (empty: boolean) => void;
}

export function SimulationsList({ selectedId, onEmptyChange }: Props) {
  const [sims, setSims] = useState<Sim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const simsRef = useRef<Sim[] | null>(null);
  simsRef.current = sims;

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      simulationsApi
        .list({ limit: 100 })
        .then((r) => {
          if (cancelled) return;
          setSims(r.simulations ?? []);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(String((e as Error)?.message ?? e));
          setSims((prev) => prev ?? []);
        });

    void load();
    const timer = setInterval(() => {
      const current = simsRef.current;
      const anyActive =
        current === null || current.some((s) => !isSimTerminal(s.status));
      if (anyActive) void load();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const sorted = useMemo(() => {
    if (!sims) return null;
    const ts = (s: Sim) => {
      const v = s.created_at ?? s.started_at;
      return v ? new Date(v).getTime() : s.sim_id;
    };
    return [...sims].sort((a, b) => ts(b) - ts(a));
  }, [sims]);

  useEffect(() => {
    if (sims === null) return;
    onEmptyChange?.(sims.length === 0);
  }, [sims, onEmptyChange]);

  if (sims === null) {
    return (
      <div className="p-4 text-[11px] uppercase tracking-[0.18em] text-muted">
        Loading…
      </div>
    );
  }

  if (sorted && sorted.length === 0) {
    return (
      <div className="p-4">
        <Empty
          title="No simulations yet"
          hint="Compose one on the right and watch the transcript stream in."
        />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {error && (
        <li className="px-4 py-2 text-[11px] text-red-700 bg-red-50">{error}</li>
      )}
      {sorted!.map((s) => {
        const turns = s.turn_count ?? s.transcript?.length ?? 0;
        const active = s.sim_id === selectedId;
        return (
          <li key={s.sim_id}>
            <Link
              to="/simulations/$simId"
              params={{ simId: String(s.sim_id) }}
              className={[
                'block px-4 py-3 transition-colors',
                active ? 'bg-panelHi' : 'hover:bg-panel',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] tracking-tightest leading-tight truncate">
                    {s.title || `Simulation #${s.sim_id}`}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {(s.participants ?? []).map((p) => {
                      const c = speakerColor(p.name);
                      return (
                        <span
                          key={p.name}
                          className="text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm border"
                          style={{
                            color: c.ink,
                            background: c.wash,
                            borderColor: c.border,
                          }}
                        >
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted font-sans">
                <span>
                  {turns}/{s.max_turns} turns
                </span>
                <span>#{s.sim_id} · {relTime(s.created_at ?? s.started_at ?? null)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
