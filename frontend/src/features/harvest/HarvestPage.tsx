import { useEffect, useState } from 'react';
import { harvestApi, type HarvestPolicy, type HarvestRun } from '../../api/harvest';
import { Btn, PageHeader } from '../../components/ui';
import { PolicyCatalog } from './PolicyCatalog';
import { TriggerForm } from './TriggerForm';
import { RunsTable } from './RunsTable';
import { HostsTable } from './HostsTable';
import { RunDetail } from './RunDetail';
import { LiveRail } from './LiveRail';

// One stacked Harvest console: Trigger → Live → History, with the policy
// catalog in a left rail and the run detail in a right rail. Hosts moved
// behind a small button — useful but not the everyday view.
export function HarvestPage() {
  const [policies, setPolicies] = useState<HarvestPolicy[] | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<HarvestPolicy | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [activeRun, setActiveRun] = useState<HarvestRun | null>(null);
  const [hostsOpen, setHostsOpen] = useState(false);
  // Bumper state used to force RunsTable to remount + re-fetch after a
  // cancel/retry from RunDetail. RunsTable doesn't expose a refresh hook,
  // so a `key` change is the cheapest way to nudge it without touching
  // its internals. The 10s internal poll would catch this eventually,
  // but the operator wants immediate feedback after their action.
  const [runsBumper, setRunsBumper] = useState(0);

  useEffect(() => {
    harvestApi
      .policies()
      .then((r) => {
        setPolicies(r.policies);
        if (!selectedPolicy && r.policies.length) setSelectedPolicy(r.policies[0]);
      })
      .catch(() => setPolicies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTriggered = (runId: number) => {
    setActiveRunId(runId);
  };

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Operator console"
        title="Harvest"
        right={
          <div className="flex items-center gap-3">
            <Btn variant="ghost" size="sm" onClick={() => setHostsOpen((v) => !v)}>
              {hostsOpen ? 'Close hosts' : 'Hosts'}
            </Btn>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted">
              {policies ? `${policies.length} policies` : 'loading'}
            </span>
          </div>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[clamp(220px,16%,280px)_minmax(0,1fr)_clamp(320px,30%,440px)] divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
        <PolicyCatalog
          policies={policies}
          selected={selectedPolicy}
          onSelect={(p) => setSelectedPolicy(p)}
        />

        <div className="flex flex-col min-h-0 overflow-y-auto">
          {hostsOpen ? (
            <HostsTable />
          ) : (
            <>
              <section className="border-b border-border">
                <TriggerForm policy={selectedPolicy} onTriggered={onTriggered} />
              </section>

              <LiveRail
                onSelect={(r) => {
                  setActiveRunId(r.Id);
                  setActiveRun(r);
                }}
                activeRunId={activeRunId}
              />

              <section className="flex-1 min-h-0">
                <RunsTable
                  key={`runs-${runsBumper}`}
                  onSelect={(r) => {
                    setActiveRunId(r.Id);
                    setActiveRun(r);
                  }}
                  activeRunId={activeRunId}
                />
              </section>
            </>
          )}
        </div>

        <RunDetail
          runId={activeRunId}
          fallback={activeRun}
          policies={policies}
          onChanged={() => setRunsBumper((n) => n + 1)}
          onOpenParent={(parentId) => setActiveRunId(parentId)}
        />
      </div>
    </div>
  );
}
