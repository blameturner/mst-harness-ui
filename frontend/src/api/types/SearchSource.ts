import type { SearchSourceRelevance } from './SearchSourceRelevance';
import type { SearchSourceType } from './SearchSourceType';
import type { SearchSourceContentType } from './SearchSourceContentType';

/** SSE shape uses `index` (1-based); persisted REST shape uses `source_index` (0-based). */
export interface SearchSource {
  index?: number;
  source_index?: number;
  title: string;
  url: string;
  relevance: SearchSourceRelevance;
  source_type: SearchSourceType;
  content_type?: SearchSourceContentType;
  snippet: string;
  used_in_answer?: boolean | number;
  message_id?: number;
  conversation_id?: number;
  org_id?: number;
}
