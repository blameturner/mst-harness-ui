declare global {
  interface Window {
    __ENV__?: { GATEWAY_URL?: string; DEFAULT_ORG_ID?: string | number };
  }
}

export function defaultOrgId(): number {
  const raw = typeof window !== 'undefined' ? window.__ENV__?.DEFAULT_ORG_ID : undefined;
  const n = typeof raw === 'number' ? raw : raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 1;
}
