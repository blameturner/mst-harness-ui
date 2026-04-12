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
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon\u2013Fri)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'custom', label: 'Custom cron' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function frequencyFromCron(expr: string): {
  frequency: Frequency;
  hour: string;
  minute: string;
  dayOfWeek: string;
  dayOfMonth: string;
} {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { frequency: 'custom', hour: '3', minute: '0', dayOfWeek: '1', dayOfMonth: '1' };

  const [min, hour, dom, mon, dow] = parts;

  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'every_minute', hour: '0', minute: '0', dayOfWeek: '1', dayOfMonth: '1' };
  if (min === '*/5' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'every_5_min', hour: '0', minute: '0', dayOfWeek: '1', dayOfMonth: '1' };
  if (min === '*/15' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'every_15_min', hour: '0', minute: '0', dayOfWeek: '1', dayOfMonth: '1' };
  if (min === '*/30' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'every_30_min', hour: '0', minute: '0', dayOfWeek: '1', dayOfMonth: '1' };
  if (hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'hourly', hour: '0', minute: min, dayOfWeek: '1', dayOfMonth: '1' };
  if (dom === '*' && mon === '*' && dow === '1-5')
    return { frequency: 'weekdays', hour, minute: min, dayOfWeek: '1', dayOfMonth: '1' };
  if (dom === '*' && mon === '*' && dow !== '*')
    return { frequency: 'weekly', hour, minute: min, dayOfWeek: dow, dayOfMonth: '1' };
  if (mon === '*' && dow === '*' && dom !== '*')
    return { frequency: 'monthly', hour, minute: min, dayOfWeek: '1', dayOfMonth: dom };
  if (dom === '*' && mon === '*' && dow === '*')
    return { frequency: 'daily', hour, minute: min, dayOfWeek: '1', dayOfMonth: '1' };

  return { frequency: 'custom', hour: hour === '*' ? '0' : hour, minute: min === '*' ? '0' : min, dayOfWeek: '1', dayOfMonth: '1' };
}

function buildCron(
  frequency: Frequency,
  hour: string,
  minute: string,
  dayOfWeek: string,
  dayOfMonth: string,
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
  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '1-5') return `Weekdays at ${time}`;
  if (dom === '*' && mon === '*' && dow !== '*')
    return `${DAY_LABELS[Number(dow)] ?? `day ${dow}`} at ${time}`;
  if (dom !== '*' && mon === '*' && dow === '*')
    return `Monthly on day ${dom} at ${time}`;
  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${time}`;
  return expr;
}

interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
}

export function CronPicker({ value, onChange }: CronPickerProps) {
  const initial = frequencyFromCron(value);
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [customCron, setCustomCron] = useState(initial.frequency === 'custom' ? value : '');

  useEffect(() => {
    if (frequency === 'custom') {
      if (customCron.trim().split(/\s+/).length === 5) onChange(customCron.trim());
      return;
    }
    onChange(buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth));
  }, [frequency, hour, minute, dayOfWeek, dayOfMonth, customCron]);

  const showTime = ['daily', 'weekdays', 'weekly', 'monthly'].includes(frequency);
  const showMinuteOnly = frequency === 'hourly';

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

      <div className="text-[11px] font-sans text-muted px-0.5">
        {humaniseCron(value)}
        <span className="ml-2 font-mono text-[10px] text-muted/70">{value}</span>
      </div>
    </div>
  );
}
