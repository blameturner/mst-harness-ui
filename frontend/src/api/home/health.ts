// frontend/src/api/home/health.ts
import { http } from '../../lib/http';
import type { HomeHealth } from './types';

export function getHomeHealth() {
  return http.get('api/home/health').json<HomeHealth>();
}
