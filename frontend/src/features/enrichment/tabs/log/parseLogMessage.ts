// Backend log messages mix free-form prose with key=value pairs (and a python-dict-shaped
// metrics={...} value). This pulls them apart so the row can show a short headline and the
// detail panel can render each pair on its own line.

export interface ParsedLogMessage {
  prefix: string;
  pairs: Array<{ key: string; value: string }>;
}

export function parseLogMessage(msg: string | null | undefined): ParsedLogMessage {
  if (!msg) return { prefix: '', pairs: [] };

  const pattern = /(\w+)=(\{[^}]*\}|\[[^\]]*\]|"[^"]*"|\S+)/g;
  const matches = Array.from(msg.matchAll(pattern));

  const pairs = matches.map((m) => ({
    key: m[1],
    value: m[2].replace(/[),\]]+$/, ''),
  }));

  const firstIdx = matches.length > 0 ? (matches[0].index ?? -1) : -1;

  let prefix: string;
  if (firstIdx === -1) {
    prefix = msg.trim();
  } else if (firstIdx > 0) {
    prefix = msg.slice(0, firstIdx).trim().replace(/[\s(]+$/, '');
  } else {
    prefix = '';
  }

  return { prefix, pairs };
}
