import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { authClient } from '../lib/auth-client';

interface NavItem {
  to: string;
  label: string;
  matchPrefix?: string;
}

const NAV: NavItem[] = [
  { to: '/home', label: 'Home' },
  { to: '/chat', label: 'Chat' },
  { to: '/code', label: 'Code' },
  { to: '/agents', label: 'Agents', matchPrefix: '/agents' },
  { to: '/research', label: 'Research', matchPrefix: '/research' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function logout() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <header className="shrink-0 h-14 border-b border-border bg-bg/90 backdrop-blur flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8 min-w-0">
          <Link
            to="/home"
            className="font-display text-lg sm:text-xl font-semibold tracking-tightest leading-none select-none whitespace-nowrap"
          >
            Jeff<span className="italic">GPT</span>
            <span className="inline-block w-1.5 h-1.5 bg-fg rounded-full align-middle ml-1.5" />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
            {NAV.map((item) => {
              const prefix = item.matchPrefix ?? item.to;
              const isActive =
                pathname === item.to || pathname.startsWith(`${prefix}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    'px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-fg text-bg'
                      : 'text-muted hover:text-fg hover:bg-panelHi',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
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
