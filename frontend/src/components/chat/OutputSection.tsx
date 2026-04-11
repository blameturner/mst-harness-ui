export function OutputSection({
  title,
  items,
  tone,
  muted,
}: {
  title: string;
  items?: string[];
  tone?: 'accent';
  muted?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex gap-2 text-sm leading-relaxed ${
              muted ? 'text-muted' : tone === 'accent' ? 'text-accent' : 'text-fg'
            }`}
          >
            <span className="text-muted select-none">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
