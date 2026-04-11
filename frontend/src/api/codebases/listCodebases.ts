import { http } from '../../lib/http';
import type { Codebase } from '../types/Codebase';

export function listCodebases() {
  return http.get('api/codebases').json<{ codebases: Codebase[] }>();
}
