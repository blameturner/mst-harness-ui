import type { DockerContainer } from '../../api/types/DockerContainer';

export function inferContainerGroup(c: DockerContainer): string {
  const name = c.name.toLowerCase();
  const image = c.image.toLowerCase();
  if (
    name.includes('llama') || name.includes('model') || name.includes('reasoner') ||
    name.includes('coder') || name.includes('fast') ||
    image.includes('llama') || image.includes('gguf') || image.includes('vllm')
  ) return 'Models';
  if (
    name.includes('redis') || name.includes('postgres') || name.includes('nocodb') ||
    name.includes('mysql') || name.includes('mongo') ||
    image.includes('redis') || image.includes('postgres') || image.includes('nocodb')
  ) return 'Data';
  if (
    name.includes('nginx') || name.includes('proxy') || name.includes('traefik') ||
    name.includes('caddy') || image.includes('nginx') || image.includes('proxy')
  ) return 'Proxy';
  return 'Services';
}
