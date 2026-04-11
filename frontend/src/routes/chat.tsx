import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { ChatPage } from '../features/chat/ChatPage';

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ChatPage,
});
