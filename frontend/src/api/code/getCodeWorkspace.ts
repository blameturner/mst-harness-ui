import { http } from '../../lib/http';
import type { CodeWorkspaceFile } from '../types/CodeWorkspaceFile';

export function getCodeWorkspace(id: number) {
  return http
    .get(`api/code/conversations/${id}/workspace`)
    .json<{ files: CodeWorkspaceFile[] }>();
}
