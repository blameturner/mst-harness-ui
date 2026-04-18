import { http } from '../../lib/http';
import type { PathfinderPreviewResponse } from '../types/PipelineSummary';

export function fetchNextPathfinderSeed() {
  return http
    .post('api/enrichment/pathfinder/fetch-next')
    .json<PathfinderPreviewResponse>();
}
