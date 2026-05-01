import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { authClient } from '../lib/auth-client';
import { useHomeChatStreaming } from '../features/home/hooks/useHomeChatStreaming';

interface NavLeaf {
  to: string;
  label: string;
  matchPrefix?: string;
  excludePrefixes?: string[];
}

interface NavGroupDef {
  label: string;
  items: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroupDef;

const NAV: NavEntry[] = [
  { to: '/home', label: 'Home' },
  { to: '/chat', label: 'Chat' },
  { to: '/code', label: 'Code' },
  { to: '/projects', label: 'Projects', matchPrefix: '/projects' },
  {
    label: 'Knowledge',
    items: [
      { to: '/research', label: 'Research', matchPrefix: '/research' },
      { to: '/graph', label: 'Graph', matchPrefix: '/graph' },
      { to: '/memory', label: 'Memory', matchPrefix: '/memory' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { to: '/agents', label: 'Agents', matchPrefix: '/agents' },
      { to: '/pa', label: 'PA', matchPrefix: '/pa' },
      { to: '/simulations', label: 'Sim', matchPrefix: '/simulations' },
    ],
  },
  {
    label: 'Pipelines',
    items: [
      { to: '/harvest', label: 'Harvest', matchPrefix: '/harvest' },
      { to: '/enrichment', label: 'Enrichment', matchPrefix: '/enrichment' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/live', label: 'Live', matchPrefix: '/live' },
      { to: '/ops', label: 'Console', matchPrefix: '/ops' },
    ],
  },
];

function isLeafActive(item: NavLeaf, pathname: string): boolean {
  const prefix = item.matchPrefix ?? item.to;
  const excluded = (item.excludePrefixes ?? []).some(
    (ex) => pathname === ex || pathname.startsWith(`${ex}/`),
  );
  if (excluded) return false;
  return pathname === item.to || pathname.startsWith(`${prefix}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const homeStreaming = useHomeChatStreaming();

  async function logout() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <header className="shrink-0 h-14 border-b border-border bg-bg/90 backdrop-blur flex items-center justify-between px-3 sm:px-6 relative z-40">
        <div className="flex items-center gap-3 sm:gap-8 min-w-0">
          <Link
            to="/home"
            className="font-display text-lg sm:text-xl font-semibold tracking-tightest leading-none select-none whitespace-nowrap"
          >
            Jeff<span className="italic">GPT</span>
            <span className="inline-block w-1.5 h-1.5 bg-fg rounded-full align-middle ml-1.5" />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
            {NAV.map((entry) =>
              'items' in entry ? (
                <NavGroup key={entry.label} group={entry} pathname={pathname} />
              ) : (
                <NavLeafLink
                  key={entry.to}
                  item={entry}
                  active={isLeafActive(entry, pathname)}
                  badge={entry.to === '/home' && homeStreaming}
                />
              ),
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => void logout()}
            className="text-[11px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function NavLeafLink({
  item,
  active,
  badge,
}: {
  item: NavLeaf;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <Link
      to={item.to}
      className={[
        'relative px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
        active ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-panelHi',
      ].join(' ')}
    >
      {item.label}
      {badge && (
        <span
          className={[
            'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse',
            active ? 'bg-bg' : 'bg-fg',
          ].join(' ')}
          title="Home chat is streaming"
          aria-hidden
        />
      )}
    </Link>
  );
}

function NavGroup({ group, pathname }: { group: NavGroupDef; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const groupActive = group.items.some((it) => isLeafActive(it, pathname));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1',
          groupActive
            ? 'bg-fg text-bg'
            : 'text-muted hover:text-fg hover:bg-panelHi',
        ].join(' ')}
      >
        {group.label}
        <span aria-hidden className="text-[8px] leading-none opacity-70">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 min-w-[10rem] bg-bg border border-border rounded-md shadow-card py-1 z-50 animate-fadeIn"
        >
          {group.items.map((it) => {
            const active = isLeafActive(it, pathname);
            return (
              <Link
                key={it.to}
                to={it.to}
                role="menuitem"
                className={[
                  'block px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-panelHi text-fg font-medium'
                    : 'text-muted hover:text-fg hover:bg-panel',
                ].join(' ')}
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
