// frontend/src/api/home/conversationExport.ts
import { defaultOrgId } from './config';
import { gatewayUrl } from '../../lib/runtime-env';

export function homeConversationExportUrl(orgId: number = defaultOrgId()): string {
  return `${gatewayUrl()}/home/conversation/export?org_id=${orgId}`;
}

export async function downloadHomeConversation(orgId: number = defaultOrgId()) {
  const res = await fetch(homeConversationExportUrl(orgId), { credentials: 'include' });
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `home-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
