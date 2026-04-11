import { http } from '../../lib/http';
import type { LlmModel } from '../types/LlmModel';

export function listModels() {
  return http.get('api/models').json<{ models: LlmModel[] }>();
}
