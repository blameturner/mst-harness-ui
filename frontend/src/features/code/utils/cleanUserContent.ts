// Old persisted messages have <attached_files> wrappers — strip them.
export function cleanUserContent(s: string): string {
  return s.replace(/<attached_files>[\s\S]*?<\/attached_files>\n*/g, '').trim();
}
