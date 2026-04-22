import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { ToastHost } from '../lib/toast/ToastHost';

const BARE_PATHS = new Set(['/', '/login', '/setup']);

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (BARE_PATHS.has(pathname)) {
    return (
      <>
        <div className="min-h-full bg-bg text-fg">
          <Outlet />
        </div>
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <ToastHost />
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
