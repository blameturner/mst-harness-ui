export function normaliseLogEntry(row: Record<string, unknown>) {
  const flags = row.flags;
  let parsedFlags: string[] = [];
  if (Array.isArray(flags)) parsedFlags = flags.map(String);
  else if (typeof flags === 'string') {
    try { parsedFlags = JSON.parse(flags); } catch { parsedFlags = []; }
  }
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    scrape_target_id: row.scrape_target_id ?? null,
    cycle_id: row.cycle_id,
    event_type: row.event_type,
    source_url: row.source_url ?? null,
    message: row.message ?? null,
    chunks_stored: row.chunks_stored ?? null,
    tokens_used: row.tokens_used ?? null,
    duration_seconds: row.duration_seconds ?? null,
    flags: parsedFlags,
    created_at: row.CreatedAt ?? row.created_at ?? null,
  };
}
