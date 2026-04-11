import ky from 'ky';
import { gatewayUrl } from './runtime-env';

export const http = ky.create({
  prefixUrl: gatewayUrl(),
  credentials: 'include',
  timeout: 300_000,
});
