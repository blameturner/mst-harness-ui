export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border rounded-md p-3 bg-panel/20">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans mb-1">{label}</div>
      <div className="text-lg font-display tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted font-sans mt-0.5">{sub}</div>}
    </div>
  );
}
