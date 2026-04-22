import { Sheet } from '../../../../../components/Sheet';
import { safeStringify } from '../lib/formatters';

export interface RowDrawerProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "discovery", "target", "job" */
  kind: string;
  id: string;
  loading?: boolean;
  error?: string | null;
  data?: unknown;
  /** Optional rich rendering above the raw JSON section. */
  extra?: React.ReactNode;
}

export function RowDrawer({ open, onClose, kind, id, loading, error, data, extra }: RowDrawerProps) {
  return (
    <Sheet
      open={open}
      side="right"
      onClose={onClose}
      widthClass="w-[92vw] max-w-[760px]"
      mobileOnlyClass=""
      label="Detail drawer"
    >
      <div className="h-full flex flex-col">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            {kind} / {id}
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          {loading && <p className="text-sm text-muted">Loading details...</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!loading && !error && (
            <>
              {extra}
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Raw JSON</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(data)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
