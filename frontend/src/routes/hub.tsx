import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/hub')({
  beforeLoad: () => { throw redirect({ to: '/home', search: { tab: undefined } }); },
  component: () => null,
});
