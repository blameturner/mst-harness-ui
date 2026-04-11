import type { Confidence } from './Confidence';

export interface AgentOutput {
  title: string;
  summary: string;
  domain: string;
  key_points: string[];
  recommendations: string[];
  next_steps: string[];
  observations: string[];
  follow_up_questions: string[];
  tags: string[];
  confidence: Confidence;
}
