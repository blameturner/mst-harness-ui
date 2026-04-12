import { useEffect, useState } from 'react';
import { getScrapeReport } from '../../../../api/enrichment/getScrapeReport';
import type { ScrapeReport } from '../../../../api/types/ScrapeReport';

const STATUS_COLORS: Record<string, string> = {
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
  rejected: 'bg-amber-500',
  unknown: 'bg-muted',
};

export function ScrapeReportPanel() {
  const [report, setReport] = useState<ScrapeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScrapeReport()
      .then((r) => setReport(r))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted text-sm font-sans py-4">Loading scrape report…</div>;
  if (error) return <div className="text-red-500 text-sm font-sans py-4">{error}</div>;
  if (!report) return null;

  const statuses = Object.entries(report.by_status);
  const total = report.total || 1;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-3">
          Scrape status ({report.total} total)
        </h3>
        <div className="flex h-4 rounded overflow-hidden border border-border">
          {statuses.map(([status, count]) => (
            <div
              key={status}
              className={`${STATUS_COLORS[status] ?? 'bg-border'} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${status}: ${count}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          {statuses.map(([status, count]) => (
            <span key={status} className="text-[11px] font-sans text-muted flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] ?? 'bg-border'}`} />
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      {report.top_failures.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-3">
            Top failure types
          </h3>
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                <th className="pb-2 pr-4">Error</th>
                <th className="pb-2 w-20">Count</th>
              </tr>
            </thead>
            <tbody>
              {report.top_failures.map(([err, count]) => (
                <tr key={err} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">{err}</td>
                  <td className="py-2 tabular-nums">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.persistent_failures.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-3">
            Persistently failing URLs
          </h3>
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
                <th className="pb-2 pr-4">URL</th>
                <th className="pb-2 pr-4 w-20">Failures</th>
                <th className="pb-2 pr-4">Error</th>
              </tr>
            </thead>
            <tbody>
              {report.persistent_failures.map((f) => (
                <tr key={f.url} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs truncate max-w-[400px]" title={f.url}>
                    {f.url}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{f.consecutive_failures}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{f.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
