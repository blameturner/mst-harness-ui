// frontend/src/api/home/health.ts
import { http } from '../../lib/http';
import type { HomeHealth } from './types';

export function getHomeHealth() {
  return http.get('home/health').json<HomeHealth>();
}
