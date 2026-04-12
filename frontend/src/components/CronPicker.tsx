import { useEffect, useState } from 'react';

/**
 * Plain-language schedule picker that produces a 5-field cron expression.
 * Supports: every N minutes, hourly, daily, weekly, monthly, weekdays, custom.
 */

type Frequency =
  | 'every_minute'
  | 'every_5_min'
  | 'every_15_min'
  | 'every_30_min'
  | 'hourly'
  | 'daily'
  | 'daily_multi'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'custom';

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'every_minute', label: 'Every minute' },
  { value: 'every_5_min', label: 'Every 5 minutes' },
  { value: 'every_15_min', label: 'Every 15 minutes' },
  { value: 'every_30_min', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Every day (one time)' },
  { value: 'daily_multi', label: 'Every day (multiple times)' },
  { value: 'weekdays', label: 'Weekdays (Mon\u2013Fri)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'custom', label: 'Custom cron' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CronState {
  frequency: Frequency;
  hour: string;
  minute: string;
  hours: number[];
  dayOfWeek: string;
  dayOfMonth: string;
}

const DEFAULTS: Pick<CronState, 'hours' | 'dayOfWeek' | 'dayOfMonth'> = {
  hours: [3], dayOfWeek: '1', dayOfMonth: '1',
};

/** Pattern table: [test, builder]. First match wins. */
const CRON_PATTERNS: [
  (min: string, hour: string, dom: string, mon: string, dow: string) => boolean,
  (min: string, hour: string, dom: string, mon: string, dow: string) => CronState,
][] = [
  // Every-N-minutes family
  [(_m, h, d, mo, dw) => _m === '*' && h === '*' && d === '*' && mo === '*' && dw === '*',
   ()             => ({ frequency: 'every_minute', hour: '0', minute: '0', ...DEFAULTS })],
  [(_m)           => _m === '*/5',
   ()             => ({ frequency: 'every_5_min', hour: '0', minute: '0', ...DEFAULTS })],
  [(_m)           => _m === '*/15',
   ()             => ({ frequency: 'every_15_min', hour: '0', minute: '0', ...DEFAULTS })],
  [(_m)           => _m === '*/30',
   ()             => ({ frequency: 'every_30_min', hour: '0', minute: '0', ...DEFAULTS })],

  // Hourly
  [(_m, h, d, mo, dw) => h === '*' && d === '*' && mo === '*' && dw === '*',
   (m)            => ({ frequency: 'hourly', hour: '0', minute: m, ...DEFAULTS })],

  // Daily at multiple hours: "0 1,3,6 * * *"
  [(_m, h, d, mo, dw) => h.includes(',') && d === '*' && mo === '*' && dw === '*',
   (m, h)         => {
     const parsed = h.split(',').map(Number).filter(Number.isFinite).sort((a, b) => a - b);
     return { frequency: 'daily_multi', hour: String(parsed[0] ?? 0), minute: m, hours: parsed, dayOfWeek: '1', dayOfMonth: '1' };
   }],

  // Weekdays
  [(_m, _h, d, mo, dw) => d === '*' && mo === '*' && dw === '1-5',
   (m, h)         => ({ frequency: 'weekdays', hour: h, minute: m, ...DEFAULTS })],

  // Weekly
  [(_m, _h, d, mo, dw) => d === '*' && mo === '*' && dw !== '*',
   (m, h, _d, _mo, dw) => ({ frequency: 'weekly', hour: h, minute: m, ...DEFAULTS, dayOfWeek: dw })],

  // Monthly
  [(_m, _h, d, mo, dw) => mo === '*' && dw === '*' && d !== '*',
   (m, h, d)      => ({ frequency: 'monthly', hour: h, minute: m, ...DEFAULTS, dayOfMonth: d })],

  // Daily (single time)
  [(_m, _h, d, mo, dw) => d === '*' && mo === '*' && dw === '*',
   (m, h)         => ({ frequency: 'daily', hour: h, minute: m, ...DEFAULTS })],
];

function frequencyFromCron(expr: string): CronState {
  const fallback: CronState = { frequency: 'custom', hour: '3', minute: '0', ...DEFAULTS };
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return fallback;

  const [min, hour, dom, mon, dow] = parts;
  for (const [test, build] of CRON_PATTERNS) {
    if (test(min, hour, dom, mon, dow)) return build(min, hour, dom, mon, dow);
  }
  return { ...fallback, hour: hour === '*' ? '0' : hour, minute: min === '*' ? '0' : min };
}

function buildCron(
  frequency: Frequency,
  hour: string,
  minute: string,
  dayOfWeek: string,
  dayOfMonth: string,
  hours?: number[],
): string {
  switch (frequency) {
    case 'every_minute':
      return '* * * * *';
    case 'every_5_min':
      return '*/5 * * * *';
    case 'every_15_min':
      return '*/15 * * * *';
    case 'every_30_min':
      return '*/30 * * * *';
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'daily_multi':
      return `${minute} ${hours && hours.length > 0 ? hours.join(',') : hour} * * *`;
    case 'weekdays':
      return `${minute} ${hour} * * 1-5`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

export function humaniseCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*') return 'Every minute';
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
  if (hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return `Every hour at :${min.padStart(2, '0')}`;

  // Multi-hour: "0 1,3,6 * * *" → "Daily at 01:00, 03:00, 06:00"
  if (hour.includes(',') && dom === '*' && mon === '*' && dow === '*') {
    const times = hour.split(',').map((h) => `${h.padStart(2, '0')}:${min.padStart(2, '0')}`);
    return `Daily at ${times.join(', ')}`;
  }

  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '1-5') return `Weekdays at ${time}`;
  if (dom === '*' && mon === '*' && dow !== '*')
    return `${DAY_LABELS[Number(dow)] ?? `day ${dow}`} at ${time}`;
  if (dom !== '*' && mon === '*' && dow === '*')
    return `Monthly on day ${dom} at ${time}`;
  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${time}`;
  return expr;
}

const COMMON_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
];

interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
  timezone?: string;
  onTimezoneChange?: (tz: string) => void;
}

export function CronPicker({ value, onChange, timezone, onTimezoneChange }: CronPickerProps) {
  const initial = frequencyFromCron(value);
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [hours, setHours] = useState<number[]>(initial.hours);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [customCron, setCustomCron] = useState(initial.frequency === 'custom' ? value : '');

  useEffect(() => {
    if (frequency === 'custom') {
      if (customCron.trim().split(/\s+/).length === 5) onChange(customCron.trim());
      return;
    }
    onChange(buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth, hours));
  }, [frequency, hour, minute, hours, dayOfWeek, dayOfMonth, customCron]);

  function toggleHour(h: number) {
    setHours((prev) => {
      const next = prev.includes(h)
        ? prev.filter((x) => x !== h)
        : [...prev, h].sort((a, b) => a - b);
      return next.length === 0 ? [h] : next;
    });
  }

  const showTime = ['daily', 'weekdays', 'weekly', 'monthly'].includes(frequency);
  const showMinuteOnly = frequency === 'hourly' || frequency === 'daily_multi';

  const sel =
    'bg-bg border border-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
          Frequency
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className={`w-full ${sel}`}
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {showMinuteOnly && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            At minute
          </label>
          <select value={minute} onChange={(e) => setMinute(e.target.value)} className={sel}>
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={String(i)}>
                :{String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      )}

      {frequency === 'daily_multi' && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            Hours (tap to toggle)
          </label>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 24 }, (_, i) => {
              const active = hours.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleHour(i)}
                  className={[
                    'text-[11px] font-mono py-1.5 rounded border transition-colors',
                    active
                      ? 'bg-fg text-bg border-fg'
                      : 'bg-bg text-muted border-border hover:border-fg hover:text-fg',
                  ].join(' ')}
                >
                  {String(i).padStart(2, '0')}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-sans text-muted mt-1">
            {hours.length} hour{hours.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}

      {showTime && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Hour
            </label>
            <select value={hour} onChange={(e) => setHour(e.target.value)} className={`w-full ${sel}`}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={String(i)}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Minute
            </label>
            <select value={minute} onChange={(e) => setMinute(e.target.value)} className={`w-full ${sel}`}>
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={String(i)}>
                  :{String(i).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {frequency === 'weekly' && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            Day of week
          </label>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={`w-full ${sel}`}>
            {DAY_LABELS.map((label, i) => (
              <option key={i} value={String(i)}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {frequency === 'monthly' && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            Day of month
          </label>
          <select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={`w-full ${sel}`}>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      {frequency === 'custom' && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            Cron expression (5-field)
          </label>
          <input
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 3 * * *"
            className={`w-full ${sel}`}
          />
          <div className="text-[10px] font-sans text-muted mt-1">
            minute hour day-of-month month day-of-week
          </div>
        </div>
      )}

      {onTimezoneChange && (
        <div>
          <label className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
            Timezone
          </label>
          <select
            value={timezone ?? ''}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className={`w-full ${sel}`}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <div className="text-[10px] font-sans text-muted mt-1">
            IANA timezone for schedule evaluation
          </div>
        </div>
      )}

      <div className="text-[11px] font-sans text-muted px-0.5">
        {humaniseCron(value)}
        {timezone && <span className="ml-1">({timezone})</span>}
        <span className="ml-2 font-mono text-[10px] text-muted/70">{value}</span>
      </div>
    </div>
  );
}
