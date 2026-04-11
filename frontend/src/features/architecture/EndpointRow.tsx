export function EndpointRow({
  path,
  method,
  purpose,
}: {
  path: string;
  method: string;
  purpose: string;
}) {
  return (
    <tr className="border-b border-border hover:bg-panelHi">
      <td className="py-2 font-mono text-xs">{path}</td>
      <td className="py-2 text-[10px] uppercase tracking-[0.12em] font-sans text-muted">
        {method}
      </td>
      <td className="py-2 text-xs text-muted">{purpose}</td>
    </tr>
  );
}
