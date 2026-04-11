import type { Context } from 'hono';
import Docker from 'dockerode';
import type { ContainerInfo } from './types/ContainerInfo.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function listContainers(c: Context) {
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
}
