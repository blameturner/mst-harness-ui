import { streamJob } from '../streamJob';
import type { ResearchRequest } from '../types/ResearchRequest';
import type { StreamEvent } from '../types/StreamEvent';

export function researchStream(
  body: ResearchRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  return streamJob('api/research', body, signal);
}
