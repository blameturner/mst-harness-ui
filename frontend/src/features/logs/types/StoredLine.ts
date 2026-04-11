import type { LogLine } from '../../../api/types/LogLine';

export interface StoredLine extends LogLine {
  key: number;
}
