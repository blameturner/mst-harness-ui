import type { Context } from 'hono';
import { stream } from 'hono/streaming';
import Docker from 'dockerode';
import { demuxDockerStream } from './demuxDockerStream.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function streamLogs(c: Context) {
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
}
