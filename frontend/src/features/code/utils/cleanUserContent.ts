// Strips legacy wrappers from messages saved before the backend started storing clean user text
export function cleanUserContent(s: string): string {
  return s.replace(/<attached_files>[\s\S]*?<\/attached_files>\n*/g, '').trim();
}
