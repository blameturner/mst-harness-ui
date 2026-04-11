// Serialise concurrent POST /api/setup calls with a process-local promise chain.
// The underlying check-then-create is a TOCTOU, and NocoDB does not expose
// transactions, so we resolve the race inside the gateway. Single-instance
// deployment is part of the contract for LAN use.
let setupLock: Promise<unknown> = Promise.resolve();

export function withSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = setupLock.then(fn, fn);
  setupLock = next.catch(() => undefined);
  return next;
}
