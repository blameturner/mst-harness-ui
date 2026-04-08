// Runtime config. Overwritten by the container entrypoint on startup from GATEWAY_URL env.
// In dev (vite), this file is served as-is and points at the local gateway.
window.__ENV__ = { GATEWAY_URL: "http://localhost:3900" };
