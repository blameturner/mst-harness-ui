// frontend/src/features/home/tabs/DashboardTab.tsx
import type { HomeOverview, HomeHealth } from '../../../api/home/types';

interface Props { overview: HomeOverview | null; health: HomeHealth | null; refetch: () => void; }

export function DashboardTab(_props: Props) {
  return <div className="p-8 text-sm text-muted">Dashboard — content in next tasks.</div>;
}
