import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import Docker from 'dockerode';
import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthVariables } from '../types/auth.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export const logsRoute = new Hono<{ Variables: AuthVariables }>();

logsRoute.use('*', requireAuth);

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

logsRoute.get('/containers', async (c) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const list: ContainerInfo[] = containers.map((ci) => ({
      id: ci.Id.slice(0, 12),
      name: (ci.Names[0] ?? '').replace(/^\//, ''),
      image: ci.Image,
      state: ci.State,
      status: ci.Status,
    }));
    return c.json({ containers: list });
  } catch (err) {
    console.error('[logs] docker connect failed — is /var/run/docker.sock mounted?', err);
    return c.json({ error: 'docker_unavailable', detail: 'Cannot connect to Docker daemon' }, 503);
  }
});

// Demux Docker's multiplexed stream header (8-byte prefix per frame).
// Byte 0 = stream type (1=stdout, 2=stderr), bytes 4-7 = payload size (big-endian).
function demuxDockerStream(
  raw: NodeJS.ReadableStream,
  onLine: (line: string, isStderr: boolean) => void,
  onEnd: () => void,
): () => void {
  let buf = Buffer.alloc(0);
  let destroyed = false;

  function processBuffer() {
    while (buf.length >= 8) {
      const streamType = buf[0];
      const payloadLen = buf.readUInt32BE(4);
      if (buf.length < 8 + payloadLen) break;
      const payload = buf.subarray(8, 8 + payloadLen).toString('utf8');
      buf = buf.subarray(8 + payloadLen);
      const isStderr = streamType === 2;
      const lines = payload.split('\n');
      for (const line of lines) {
        if (line.length > 0) onLine(line, isStderr);
      }
    }
  }

  raw.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    processBuffer();
  });

  raw.on('end', onEnd);
  raw.on('error', onEnd);

  return () => {
    if (!destroyed) {
      destroyed = true;
      (raw as any).destroy?.();
    }
  };
}

logsRoute.get('/stream', async (c) => {
  const sinceParam = c.req.query('since') ?? '60';
  const tailParam = c.req.query('tail') ?? '200';
  const sinceSeconds = parseInt(sinceParam, 10) || 60;
  const tail = parseInt(tailParam, 10) || 200;

  let containers: Awaited<ReturnType<typeof docker.listContainers>>;
  try {
    containers = await docker.listContainers({ all: false });
  } catch (err) {
    console.error('[logs] docker connect failed — is /var/run/docker.sock mounted?', err);
    return c.json({ error: 'docker_unavailable', detail: 'Cannot connect to Docker daemon' }, 503);
  }
  if (containers.length === 0) {
    return c.json({ error: 'no running containers' }, 404);
  }

  return stream(c, async (s) => {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const destroyers: Array<() => void> = [];
    const flushQueue: string[] = [];
    let flushing = false;

    function enqueue(data: string) {
      flushQueue.push(data);
      if (!flushing) scheduleFlush();
    }

    function scheduleFlush() {
      flushing = true;
      setTimeout(async () => {
        const batch = flushQueue.splice(0, flushQueue.length);
        if (batch.length > 0) {
          try {
            await s.write(batch.join(''));
          } catch {}
        }
        if (flushQueue.length > 0) {
          scheduleFlush();
        } else {
          flushing = false;
        }
      }, 100);
    }

    const sinceTs = Math.floor(Date.now() / 1000) - sinceSeconds;

    for (const ci of containers) {
      const name = (ci.Names[0] ?? '').replace(/^\//, '');
      const id = ci.Id.slice(0, 12);
      const container = docker.getContainer(ci.Id);

      try {
        const logStream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          since: sinceTs,
          tail,
          timestamps: true,
        });

        const destroy = demuxDockerStream(
          logStream as unknown as NodeJS.ReadableStream,
          (line, isStderr) => {
            // Docker timestamps prefix: "2024-01-15T10:30:00.123456789Z actual log line"
            let ts = '';
            let text = line;
            const spaceIdx = line.indexOf(' ');
            if (spaceIdx > 0 && line[4] === '-') {
              ts = line.slice(0, spaceIdx);
              text = line.slice(spaceIdx + 1);
            }

            const event = JSON.stringify({
              container: name,
              id,
              ts,
              text,
              stderr: isStderr || undefined,
            });
            enqueue(`data: ${event}\n\n`);
          },
          () => {},
        );
        destroyers.push(destroy);
      } catch {}
    }

    // Keep-alive ping every 15s
    const ping = setInterval(() => {
      enqueue(': ping\n\n');
    }, 15_000);

    s.onAbort(() => {
      clearInterval(ping);
      for (const destroy of destroyers) destroy();
    });

    // Block until aborted
    await new Promise<void>((resolve) => {
      s.onAbort(resolve);
    });
  });
});
