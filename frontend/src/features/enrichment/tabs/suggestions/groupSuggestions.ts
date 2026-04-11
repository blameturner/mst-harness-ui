import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import type { SuggestedScrapeTarget } from '../../../../api/types/SuggestedScrapeTarget';
import type { SuggestionGroup } from '../../types/SuggestionGroup';

export function groupSuggestions(
  items: SuggestedScrapeTarget[],
  sources: ScrapeTarget[],
): SuggestionGroup[] {
  const byParent = new Map<number | null, SuggestedScrapeTarget[]>();
  for (const s of items) {
    const key = s.parent_target;
    const list = byParent.get(key);
    if (list) list.push(s);
    else byParent.set(key, [s]);
  }

  const groups: SuggestionGroup[] = [];
  const standalone = byParent.get(null);
  if (standalone) {
    groups.push({ parentId: null, parentName: null, parentUrl: null, items: standalone });
    byParent.delete(null);
  }
  for (const [parentId, children] of byParent) {
    const parent = sources.find((src) => src.id === parentId);
    groups.push({
      parentId,
      parentName: parent?.name ?? `Source #${parentId}`,
      parentUrl: parent?.url ?? null,
      items: children,
    });
  }
  return groups;
}
