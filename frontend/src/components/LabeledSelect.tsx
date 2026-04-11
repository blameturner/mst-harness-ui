import { Select } from './Select';

export function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
        {label}
      </span>
      <Select
        value={value}
        onChange={(v) => onChange(v)}
        options={options.map((o) => ({ value: o, label: o }))}
        position="below"
      />
    </div>
  );
}
