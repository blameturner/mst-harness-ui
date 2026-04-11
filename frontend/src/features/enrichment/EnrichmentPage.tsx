import { Link } from '@tanstack/react-router';
import { EnrichmentContent } from './EnrichmentContent';

export function EnrichmentPage() {
  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link to="/chat" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
            ← back
          </Link>
          <h1 className="font-display text-2xl tracking-tightest">Enrichment</h1>
        </div>
      </header>
      <EnrichmentContent />
    </div>
  );
}
