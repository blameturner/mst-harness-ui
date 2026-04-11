// Harness rows come back with NocoDB casing (Id, CreatedAt). Frontend wants lowercase id.
// This mapper bridges the gap so the FE never needs to know about the backend shape.
export function normaliseSource(row: Record<string, unknown>) {
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    name: row.name,
    url: row.url,
    category: row.category,
    frequency_hours: row.frequency_hours,
    last_scraped_at: row.last_scraped_at ?? null,
    status: row.status ?? null,
    chunk_count: row.chunk_count ?? 0,
    content_hash: row.content_hash ?? null,
    active: row.active === true || row.active === 1 || row.active === '1' || row.active === 'true',
    enrichment_agent_id: row.enrichment_agent_id ?? null,
    use_playwright: row.use_playwright === true || row.use_playwright === 1,
    playwright_fallback: row.playwright_fallback === true || row.playwright_fallback === 1,
    parent_target: row.parent_target ?? null,
  };
}
