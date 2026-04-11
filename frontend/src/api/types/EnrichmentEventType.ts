import { ENRICHMENT_EVENT_TYPES } from '../constants/ENRICHMENT_EVENT_TYPES';

export type EnrichmentEventType = (typeof ENRICHMENT_EVENT_TYPES)[number];
