import { useEffect, useRef, useState } from 'react';
import { HTTPError } from '../../lib/http';
import {
  adminApi,
  queueEventStreamUrl,
  type AdminRuntimeResponse,
  type AdminRuntimeRow,
  type TriggerSchemaField,
  type TriggerSchemaResponse,
} from '../../api/admin';
import type { QueueEvent } from '../../api/types/QueueEvent';
import { Btn, Drawer, Empty, Eyebrow, Field, StatusPill, TextInput } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

const POLL_MS = 5000;
const TICKER_MAX = 60;

interface TickerEntry {
  id: string;
  ts: number;
  text: string;
  tone: 'queued' | 'dispatched' | 'completed' | 'failed' | 'cancelled';
}

export function ControlPlaneTab() {
  const [data, setData] = useState<AdminRuntimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [triggerSchema, setTriggerSchema] = useState<TriggerSchemaResponse | null>(null);
  const [triggerErrors, setTriggerErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      adminApi
        .runtime()
        .then((r) => {
          if (cancelled) return;
          setData(r);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(String((e as Error)?.message ?? e));
        });
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 4000);
  };

  const onRunNow = async (row: AdminRuntimeRow) => {
    setBusy(row.id);
    try {
      const schema = await adminApi.triggerSchema(row.id).catch(() => null);
      if (schema && schema.required.length > 0) {
        setTriggerSchema(schema);
        return; // drawer takes over
      }
      const r = await adminApi.trigger(row.id);
      showFlash(`Queued ${row.label} · ${r.job_id.slice(0, 8)}`);
    } catch (e) {
      setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmitTrigger = async (payload: Record<string, unknown>) => {
    if (!triggerSchema) return;
    const id = triggerSchema.subsystem;
    setBusy(id);
    setTriggerErrors({});
    try {
      const r = await adminApi.trigger(id, { payload });
      showFlash(`Queued ${triggerSchema.label} · ${r.job_id.slice(0, 8)}`);
      setTriggerSchema(null);
    } catch (e) {
      const errs = await extractFieldErrors(e);
      if (errs) setTriggerErrors(errs);
      else setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggle = async (row: AdminRuntimeRow) => {
    setBusy(row.id);
    try {
      const enabled = row.enabled !== false;
      const fn = enabled ? adminApi.disable : adminApi.enable;
      const r = await fn(row.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              subsystems: prev.subsystems.map((s) =>
                s.id === row.id ? { ...s, enabled: r.enabled } : s,
              ),
            }
          : prev,
      );
      showFlash(`${row.label} ${r.enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setError(await formatError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5 space-y-6">
      <PulseStrip data={data} />

      {flash && (
        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
          {flash}
        </div>
      )}
      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded flex items-start justify-between gap-2">
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data === null
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : data.subsystems.length === 0
            ? <div className="col-span-full"><Empty title="no subsystems registered" /></div>
            : data.subsystems.map((s) => (
                <SubsystemCard
                  key={s.id}
                  row={s}
                  busy={busy === s.id}
                  onTrigger={() => void onRunNow(s)}
                  onToggle={() => void onToggle(s)}
                />
              ))}
      </div>

      <EventTicker />

      <TriggerDrawer
        schema={triggerSchema}
        errors={triggerErrors}
        busy={busy === triggerSchema?.subsystem}
        onClose={() => {
          setTriggerSchema(null);
          setTriggerErrors({});
        }}
        onSubmit={onSubmitTrigger}
      />
    </div>
  );
}

async function formatError(e: unknown): Promise<string> {
  if (e instanceof HTTPError) {
    try {
      const body = (await e.response.clone().json()) as { detail?: unknown };
      const detail = body.detail;
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail === 'object' && 'errors' in detail) {
        const errs = (detail as { errors?: unknown }).errors;
        if (Array.isArray(errs)) return errs.map((x) => String(x)).join('; ');
      }
      return JSON.stringify(detail ?? body);
    } catch {
      return e.message;
    }
  }
  return String((e as Error)?.message ?? e);
}

async function extractFieldErrors(e: unknown): Promise<Record<string, string> | null> {
  if (!(e instanceof HTTPError)) return null;
  try {
    const body = (await e.response.clone().json()) as { detail?: unknown };
    const detail = body.detail;
    if (!detail || typeof detail !== 'object') return null;
    const errs = (detail as { errors?: unknown }).errors;
    if (!Array.isArray(errs)) return null;
    const out: Record<string, string> = {};
    for (const item of errs) {
      if (typeof item === 'string') {
        out._global = (out._global ? `${out._global}; ` : '') + item;
      } else if (item && typeof item === 'object' && 'field' in item && 'message' in item) {
        const r = item as { field: string; message: string };
        out[r.field] = r.message;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function PulseStrip({ data }: { data: AdminRuntimeResponse | null }) {
  const huey = data?.huey;
  const queue = data?.queue;
  const scheduler = data?.scheduler;

  const hueyTone = !huey
    ? 'neutral'
    : huey.consumer_running === false || huey.consumer_healthy === false
      ? 'error'
      : huey.workers != null && huey.active_workers === huey.workers
        ? 'warn'
        : 'success';
  const hueyLabel = !huey
    ? 'huey: …'
    : huey.consumer_running === false
      ? 'huey: stopped'
      : `huey: ${huey.active_workers ?? 0}/${huey.workers ?? 0} workers`;

  const backoff = queue?.backoff;
  const idleTone = !backoff
    ? 'neutral'
    : backoff.state === 'clear'
      ? 'success'
      : 'warn';
  const idleLabel = !backoff
    ? 'idle gate: …'
    : backoff.state === 'clear'
      ? 'idle gate: clear'
      : `idle gate: ${backoff.state}${backoff.remaining_s != null ? ` ${backoff.remaining_s}s` : ''}`;

  const total = queue?.total ?? 0;
  const queued = queue?.by_status?.queued ?? 0;
  const running = queue?.by_status?.running ?? 0;

  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] uppercase tracking-[0.18em]">
      <StatusPill status={hueyLabel} tone={hueyTone}>{hueyLabel}</StatusPill>
      <StatusPill status={idleLabel} tone={idleTone}>{idleLabel}</StatusPill>
      <span className="text-muted">queue: {total} total · {queued} queued · {running} running</span>
      {scheduler?.next_fire_at && (
        <span className="text-muted">next scheduled: {relTime(scheduler.next_fire_at)}</span>
      )}
    </div>
  );
}

function SubsystemCard({
  row,
  busy,
  onTrigger,
  onToggle,
}: {
  row: AdminRuntimeRow;
  busy: boolean;
  onTrigger: () => void;
  onToggle: () => void;
}) {
  const inFlight = row.in_flight ?? (row.queued ?? 0) + (row.running ?? 0);
  const enabled = row.enabled !== false;
  const togglable = !!row.feature_section;
  const lastTone = row.last_run_status === 'failed'
    ? 'text-red-700'
    : row.last_run_status === 'completed'
      ? 'text-emerald-700'
      : 'text-muted';

  return (
    <div className="border border-border rounded-md bg-bg p-4 flex flex-col gap-3 hover:border-fg/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-[15px] tracking-tightest leading-tight truncate">
            {row.label}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono mt-0.5">
            {row.id}
          </div>
        </div>
        {togglable ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title={enabled ? 'Click to disable' : 'Click to enable'}
            className="shrink-0 disabled:opacity-50"
          >
            <StatusPill
              status={enabled ? 'enabled' : 'disabled'}
              tone={enabled ? 'success' : 'neutral'}
            >
              {enabled ? 'enabled' : 'disabled'}
            </StatusPill>
          </button>
        ) : (
          <StatusPill status="active" tone="neutral">on demand</StatusPill>
        )}
      </div>

      <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
        <dt className="text-muted">in flight</dt>
        <dd className="font-mono">
          {inFlight}
          {(row.queued != null || row.running != null) && (
            <span className="text-muted"> ({row.queued ?? 0} queued, {row.running ?? 0} running)</span>
          )}
        </dd>
        <dt className="text-muted">last run</dt>
        <dd className={`font-mono ${lastTone}`}>
          {row.last_run_at ? `${relTime(row.last_run_at)} — ${row.last_run_status ?? 'unknown'}` : '—'}
        </dd>
        <dt className="text-muted">24h</dt>
        <dd className="font-mono">
          <span className="text-emerald-700">✓ {row.completed_24h ?? 0}</span>
          <span className="text-muted"> · </span>
          <span className={row.failed_24h ? 'text-red-700' : 'text-muted'}>✗ {row.failed_24h ?? 0}</span>
        </dd>
        {row.next_scheduled_at && (
          <>
            <dt className="text-muted">next</dt>
            <dd className="font-mono text-muted">
              {row.next_scheduled_label ? `${row.next_scheduled_label} · ` : ''}
              {relTime(row.next_scheduled_at)}
            </dd>
          </>
        )}
        {row.last_run_error && (
          <>
            <dt className="text-muted">error</dt>
            <dd className="text-red-700 truncate" title={row.last_run_error}>
              {row.last_run_error}
            </dd>
          </>
        )}
      </dl>

      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/60">
        <Btn
          size="sm"
          variant="primary"
          disabled={busy || row.supports_trigger === false}
          onClick={onTrigger}
        >
          {busy ? 'Triggering…' : 'Run now'}
        </Btn>
      </div>
    </div>
  );
}

function TriggerDrawer({
  schema,
  errors,
  busy,
  onClose,
  onSubmit,
}: {
  schema: TriggerSchemaResponse | null;
  errors: Record<string, string>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!schema) return;
    const initial: Record<string, unknown> = {};
    for (const f of [...schema.required, ...schema.optional]) {
      if (f.default !== undefined) initial[f.name] = f.default;
    }
    setValues(initial);
  }, [schema]);

  if (!schema) return null;

  const fields = [...schema.required, ...schema.optional];
  const requiredNames = new Set(schema.required.map((f) => f.name));

  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === '' || v === null) continue;
      payload[f.name] = v;
    }
    onSubmit(payload);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-md"
      eyebrow="Run now"
      title={schema.label}
      meta={schema.trigger_job_type}
      actions={
        <>
          <Btn variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Run now'}
          </Btn>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
        </>
      }
    >
      {schema.description && (
        <p className="text-xs text-muted mb-4">{schema.description}</p>
      )}
      {errors._global && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded mb-3">
          {errors._global}
        </div>
      )}
      {fields.length === 0 ? (
        <p className="text-xs text-muted">No parameters required.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((f) => (
            <SchemaFieldInput
              key={f.name}
              field={f}
              required={requiredNames.has(f.name)}
              value={values[f.name]}
              error={errors[f.name]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

function SchemaFieldInput({
  field,
  required,
  value,
  error,
  onChange,
}: {
  field: TriggerSchemaField;
  required: boolean;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span>
      {field.name}
      {required && <span className="text-red-700 ml-1">*</span>}
    </span>
  );
  const hint = error ? <span className="text-red-700">{error}</span> : field.description;

  if (field.type === 'boolean') {
    return (
      <Field label={label} hint={hint}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-muted">{value ? 'true' : 'false'}</span>
        </label>
      </Field>
    );
  }

  if (field.type === 'enum' && field.options) {
    return (
      <Field label={label} hint={hint}>
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full bg-bg border border-border rounded-sm px-2.5 py-1.5 text-sm focus:outline-none focus:border-fg"
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={String(o)} value={String(o)}>{String(o)}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <Field label={label} hint={hint}>
        <TextInput
          type="number"
          mono
          min={field.min}
          max={field.max}
          step={field.type === 'integer' ? 1 : undefined}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') return onChange(undefined);
            const n = field.type === 'integer' ? parseInt(v, 10) : parseFloat(v);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
        />
      </Field>
    );
  }

  // string, array, object → text input (object/array as JSON)
  const isJson = field.type === 'array' || field.type === 'object';
  return (
    <Field label={label} hint={hint ?? (isJson ? 'JSON value' : undefined)}>
      <TextInput
        mono={isJson}
        placeholder={isJson ? (field.type === 'array' ? '[ ... ]' : '{ ... }') : undefined}
        value={
          value == null
            ? ''
            : isJson && typeof value !== 'string'
              ? JSON.stringify(value)
              : String(value)
        }
        onChange={(e) => {
          const v = e.target.value;
          if (!isJson) return onChange(v);
          try {
            onChange(v === '' ? undefined : JSON.parse(v));
          } catch {
            onChange(v); // hold raw string; backend will reject if invalid
          }
        }}
      />
    </Field>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-border rounded-md bg-bg p-4 h-[180px] animate-pulse">
      <div className="h-4 w-32 bg-panel rounded mb-2" />
      <div className="h-3 w-20 bg-panel rounded mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-panel rounded" />
        <div className="h-3 w-3/4 bg-panel rounded" />
        <div className="h-3 w-1/2 bg-panel rounded" />
      </div>
    </div>
  );
}

function EventTicker() {
  const [entries, setEntries] = useState<TickerEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(queueEventStreamUrl(), { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!stopped) retryTimer = setTimeout(connect, 3000);
      };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          const text = formatEvent(ev);
          if (!text) return;
          const tone = ev.type.replace('job_', '') as TickerEntry['tone'];
          const id = `${Date.now()}-${seq.current++}`;
          setEntries((prev) => [{ id, ts: Date.now(), text, tone }, ...prev].slice(0, TICKER_MAX));
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Live events</Eyebrow>
        <span
          className={`text-[10px] uppercase tracking-[0.18em] ${
            connected ? 'text-emerald-700' : 'text-muted'
          }`}
        >
          {connected ? '● connected' : '○ reconnecting…'}
        </span>
      </div>
      <div className="border border-border rounded-md bg-panel/30 max-h-64 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted px-3 py-4">
            waiting for events…
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map((e) => (
              <li key={e.id} className="px-3 py-1.5 flex items-baseline gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass(e.tone)}`} />
                <span className="text-muted font-mono w-16 shrink-0">{relTime(new Date(e.ts).toISOString())}</span>
                <span className="truncate text-fg/90">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatEvent(ev: QueueEvent): string | null {
  switch (ev.type) {
    case 'job_queued':
      return `queued · ${ev.job_type} · ${ev.job_id.slice(0, 8)} (priority ${ev.priority})`;
    case 'job_dispatched':
      return `dispatched · ${ev.job_type} · ${ev.job_id.slice(0, 8)}`;
    case 'job_completed':
      return `completed · ${ev.job_type} · ${ev.job_id.slice(0, 8)} in ${ev.duration_s.toFixed(1)}s`;
    case 'job_failed':
      return `failed · ${ev.job_type} · ${ev.job_id.slice(0, 8)} · ${ev.error}`;
    case 'job_cancelled':
      return `cancelled · ${ev.job_id.slice(0, 8)}`;
    default:
      return null;
  }
}

function dotClass(tone: TickerEntry['tone']): string {
  switch (tone) {
    case 'completed':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-red-500';
    case 'cancelled':
      return 'bg-amber-500';
    case 'dispatched':
      return 'bg-sky-500';
    case 'queued':
    default:
      return 'bg-muted';
  }
}
