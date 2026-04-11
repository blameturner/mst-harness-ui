export function normaliseSuggestion(row: Record<string, unknown>) {
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    url: row.url,
    name: row.name,
    category: row.category,
    reason: row.reason ?? null,
    confidence: row.confidence,
    confidence_score: row.confidence_score,
    suggested_by_url: row.suggested_by_url ?? null,
    suggested_by_cycle: row.suggested_by_cycle ?? null,
    times_suggested: row.times_suggested ?? 1,
    status: row.status,
    reviewed_by_user_id: row.reviewed_by_user_id ?? null,
    reviewed_at: row.reviewed_at ?? null,
    parent_target: row.parent_target ?? null,
  };
}
