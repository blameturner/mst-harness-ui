import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/hub_/research/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/research/$id',
      params: { id: params.id },
      replace: true,
    });
  },
});
