import { streamJob } from '../streamJob';
import type { ChatStreamRequest } from '../types/ChatStreamRequest';
import type { StreamEvent } from '../types/StreamEvent';

export function chatStream(
  body: ChatStreamRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  return streamJob('api/chat', body, signal);
}
