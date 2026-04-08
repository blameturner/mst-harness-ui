// Runtime config loaded from /config.js (see index.html). The container entrypoint
// rewrites /config.js at startup from the GATEWAY_URL env var, so nothing is baked
// into the bundle at build time.
declare global {
  interface Window {
    __ENV__?: { GATEWAY_URL?: string };
  }
}

export function gatewayUrl(): string {
  const url = typeof window !== 'undefined' ? window.__ENV__?.GATEWAY_URL : undefined;
  if (!url) {
    throw new Error(
      'GATEWAY_URL is not set. /config.js must define window.__ENV__.GATEWAY_URL.',
    );
  }
  return url.replace(/\/$/, '');
}
