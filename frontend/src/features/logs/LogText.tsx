import { LEVEL_RE } from './constants/LEVEL_RE';

export function LogText({ text, highlight }: { text: string; highlight: string }) {
  const levelMatch = text.match(LEVEL_RE);

  let levelClass = '';
  let level = '';
  let levelIdx = -1;

  if (levelMatch) {
    level = levelMatch[1];
    levelIdx = levelMatch.index!;
    if (level === 'ERROR' || level === 'FATAL' || level === 'PANIC') levelClass = 'text-red-400 font-semibold';
    else if (level === 'WARN' || level === 'WARNING') levelClass = 'text-amber-400';
    else if (level === 'INFO') levelClass = 'text-blue-400';
    else if (level === 'DEBUG' || level === 'TRACE') levelClass = 'text-muted';
  }

  if (!highlight && !levelMatch) return <span>{text}</span>;

  const parts: Array<{ text: string; className?: string }> = [];
  if (levelMatch) {
    if (levelIdx > 0) parts.push({ text: text.slice(0, levelIdx), className: 'text-muted/70' });
    parts.push({ text: level, className: levelClass });
    if (levelIdx + level.length < text.length) parts.push({ text: text.slice(levelIdx + level.length) });
  } else {
    parts.push({ text });
  }

  if (!highlight) {
    return (
      <>
        {parts.map((p, i) => (
          <span key={i} className={p.className}>{p.text}</span>
        ))}
      </>
    );
  }

  const lower = highlight.toLowerCase();
  return (
    <>
      {parts.map((p, i) => {
        const idx = p.text.toLowerCase().indexOf(lower);
        if (idx === -1) return <span key={i} className={p.className}>{p.text}</span>;
        return (
          <span key={i} className={p.className}>
            {p.text.slice(0, idx)}
            <mark className="bg-amber-300/40 text-inherit rounded-sm px-px">{p.text.slice(idx, idx + highlight.length)}</mark>
            {p.text.slice(idx + highlight.length)}
          </span>
        );
      })}
    </>
  );
}
