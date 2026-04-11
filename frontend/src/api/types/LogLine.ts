export interface LogLine {
  container: string;
  id: string;
  ts: string;
  text: string;
  stderr?: boolean;
}
