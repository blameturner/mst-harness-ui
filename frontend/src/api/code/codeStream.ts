import { streamJob } from '../streamJob';
import type { CodeStreamRequest } from '../types/CodeStreamRequest';
import type { StreamEvent } from '../types/StreamEvent';

export function codeStream(
  body: CodeStreamRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  return streamJob('api/code', body, signal);
}
