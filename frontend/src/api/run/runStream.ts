import { streamJob } from '../streamJob';
import type { RunStreamRequest } from '../types/RunStreamRequest';
import type { StreamEvent } from '../types/StreamEvent';

export function runStream(
  body: RunStreamRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  return streamJob('api/run/stream', body, signal);
}
