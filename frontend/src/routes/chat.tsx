import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { ChatPage } from '../features/chat/ChatPage';

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: ChatPage,
});
