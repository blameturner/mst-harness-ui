export function LabeledCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-fg"
      />
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
        {label}
      </span>
    </label>
  );
}
