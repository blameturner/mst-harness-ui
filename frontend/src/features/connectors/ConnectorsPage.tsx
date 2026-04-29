import { useState } from 'react';
import { ApisTab } from './apis/ApisTab';
import { SmtpTab } from './smtp/SmtpTab';
import { SecretsTab } from './secrets/SecretsTab';

export type ConnectorsTabId = 'apis' | 'smtp' | 'secrets';

const TABS: { id: ConnectorsTabId; label: string }[] = [
  { id: 'apis', label: 'APIs' },
  { id: 'smtp', label: 'SMTP' },
  { id: 'secrets', label: 'Secrets' },
];

export function ConnectorsPage() {
  const [tab, setTab] = useState<ConnectorsTabId>('apis');

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl tracking-tightest">Connectors</h1>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-muted">
          External integrations · scoped per org
        </span>
      </header>

      <nav className="shrink-0 border-b border-border px-2 sm:px-8 flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar bg-bg sticky top-0 z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'apis' && <ApisTab />}
        {tab === 'smtp' && <SmtpTab />}
        {tab === 'secrets' && <SecretsTab />}
      </div>
    </div>
  );
}
