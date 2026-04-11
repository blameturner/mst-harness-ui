import { useEffect, useMemo, useState } from 'react';
import type { EnrichmentAgent } from '../../../../api/types/EnrichmentAgent';
import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import type { SuggestedScrapeTarget } from '../../../../api/types/SuggestedScrapeTarget';
import { listEnrichmentSources } from '../../../../api/enrichment/listEnrichmentSources';
import { listEnrichmentAgents } from '../../../../api/enrichment/listEnrichmentAgents';
import { listEnrichmentSuggestions } from '../../../../api/enrichment/listEnrichmentSuggestions';
import { approveEnrichmentSuggestion } from '../../../../api/enrichment/approveEnrichmentSuggestion';
import { rejectEnrichmentSuggestion } from '../../../../api/enrichment/rejectEnrichmentSuggestion';
import { approveEnrichmentSuggestionsByParent } from '../../../../api/enrichment/approveEnrichmentSuggestionsByParent';
import { rejectEnrichmentSuggestionsByParent } from '../../../../api/enrichment/rejectEnrichmentSuggestionsByParent';
import { Select } from '../../../../components/Select';
import { groupSuggestions } from './groupSuggestions';

export function SuggestionsTab() {
  const [items, setItems] = useState<SuggestedScrapeTarget[]>([]);
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [agents, setAgents] = useState<EnrichmentAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [approveAgentId, setApproveAgentId] = useState<string>('');
  const [bulkReviewing, setBulkReviewing] = useState<number | null>(null);
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sugRes, agRes, srcRes] = await Promise.all([
        listEnrichmentSuggestions(statusFilter),
        listEnrichmentAgents(),
        listEnrichmentSources(),
      ]);
      setItems(sugRes.suggestions);
      setAgents(agRes.agents ?? []);
      setSources(srcRes.sources ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function approve(id: number) {
    try {
      const body: { enrichment_agent_id?: number } = {};
      if (approveAgentId) body.enrichment_agent_id = Number(approveAgentId);
      await approveEnrichmentSuggestion(id, body);
      setReviewing(null);
      setApproveAgentId('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function reject(id: number) {
    try {
      await rejectEnrichmentSuggestion(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function bulkApprove(parentTarget: number) {
    try {
      const body: { enrichment_agent_id?: number } = {};
      if (bulkAgentId) body.enrichment_agent_id = Number(bulkAgentId);
      await approveEnrichmentSuggestionsByParent(parentTarget, body);
      setBulkReviewing(null);
      setBulkAgentId('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function bulkReject(parentTarget: number) {
    try {
      await rejectEnrichmentSuggestionsByParent(parentTarget);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function toggleGroupCollapsed(parentId: number) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  const groups = useMemo(() => groupSuggestions(items, sources), [items, sources]);

  const statusTabs: { id: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {statusTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={[
              'px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-sans border transition-colors',
              statusFilter === t.id
                ? 'border-fg bg-fg text-bg'
                : 'border-border text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted font-sans">No {statusFilter} suggestions.</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.parentId ?? 'standalone'}>
              {group.parentId != null && (
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => toggleGroupCollapsed(group.parentId!)}
                    className="text-[10px] font-sans text-muted hover:text-fg"
                  >
                    {collapsedGroups.has(group.parentId) ? '▶' : '▼'}
                  </button>
                  <h3 className="font-display text-base">
                    {group.parentName}
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans bg-panel border border-border px-2 py-0.5">
                    {group.items.length} sub-page{group.items.length !== 1 ? 's' : ''} pending
                  </span>
                  {group.parentUrl && (
                    <a
                      href={group.parentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-sans text-muted underline truncate max-w-[300px]"
                    >
                      {group.parentUrl}
                    </a>
                  )}
                  {statusFilter === 'pending' && (
                    <>
                      {bulkReviewing === group.parentId ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <Select
                            value={bulkAgentId}
                            onChange={setBulkAgentId}
                            placeholder="agent"
                            options={[
                              { value: '', label: 'None' },
                              ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
                            ]}
                            position="below"
                          />
                          <button
                            onClick={() => bulkApprove(group.parentId!)}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                          >
                            confirm all
                          </button>
                          <button
                            onClick={() => { setBulkReviewing(null); setBulkAgentId(''); }}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted"
                          >
                            cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => { setBulkReviewing(group.parentId!); setBulkAgentId(''); }}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                          >
                            approve all
                          </button>
                          <button
                            onClick={() => bulkReject(group.parentId!)}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-3 py-1 hover:border-red-700 hover:text-red-700"
                          >
                            reject all
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {group.parentId == null && groups.length > 1 && (
                <h3 className="font-display text-base mb-3">Standalone</h3>
              )}

              {(group.parentId == null || !collapsedGroups.has(group.parentId)) && (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${group.parentId != null ? 'ml-5' : ''}`}>
                  {group.items.map((s) => {
                    const borderColor =
                      s.confidence === 'high'
                        ? 'border-green-600'
                        : s.confidence === 'medium'
                          ? 'border-amber-600'
                          : 'border-red-600';
                    return (
                      <div
                        key={s.id}
                        className={`bg-panel border-l-4 ${borderColor} border-t border-r border-b border-border p-4`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-display text-lg">{s.name}</h3>
                          <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                            {s.confidence} · score {s.confidence_score}
                          </span>
                        </div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-sans text-muted underline break-all"
                        >
                          {s.url}
                        </a>
                        <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mt-2">
                          {s.category} · seen {s.times_suggested}×
                          {s.suggested_by_url && (
                            <span> · from {s.suggested_by_url}</span>
                          )}
                        </div>
                        {s.reason && <p className="text-sm text-fg mt-3">{s.reason}</p>}
                        {statusFilter === 'pending' && (
                          <>
                            {reviewing === s.id ? (
                              <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                                    agent
                                  </span>
                                  <Select
                                    value={approveAgentId}
                                    onChange={setApproveAgentId}
                                    placeholder="none"
                                    options={[
                                      { value: '', label: 'None' },
                                      ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
                                    ]}
                                    position="below"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => approve(s.id)}
                                    className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                                  >
                                    confirm
                                  </button>
                                  <button
                                    onClick={() => { setReviewing(null); setApproveAgentId(''); }}
                                    className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted"
                                  >
                                    cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 flex gap-2">
                                <button
                                  onClick={() => {
                                    setReviewing(s.id);
                                    setApproveAgentId('');
                                  }}
                                  className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                                >
                                  approve
                                </button>
                                <button
                                  onClick={() => reject(s.id)}
                                  className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-3 py-1 hover:border-red-700 hover:text-red-700"
                                >
                                  reject
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
