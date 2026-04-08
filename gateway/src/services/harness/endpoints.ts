import { harnessClient } from './client.js';
import {
  HARNESS_HEALTH_TIMEOUT_MS,
  HARNESS_MODELS_TIMEOUT_MS,
  HARNESS_RUN_TIMEOUT_MS,
} from '../../constants/timeouts.js';
import type { HarnessRunRequest } from '../../types/harness.js';

export function health(): Promise<Response> {
  return harnessClient.get('/health', HARNESS_HEALTH_TIMEOUT_MS);
}

export function listModels(): Promise<Response> {
  return harnessClient.get('/models', HARNESS_MODELS_TIMEOUT_MS);
}

export function run(payload: HarnessRunRequest): Promise<Response> {
  return harnessClient.post('/run', payload, HARNESS_RUN_TIMEOUT_MS);
}
