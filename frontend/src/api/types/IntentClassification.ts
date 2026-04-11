import type { ChatRoute } from './ChatRoute';
import type { ChatIntent } from './ChatIntent';

export interface IntentClassification {
  route: ChatRoute;
  intent: ChatIntent;
  secondary_intent?: ChatIntent;
  entities: string[];
  confidence: number;
}
