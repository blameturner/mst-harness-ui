export interface Worker {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  [k: string]: unknown;
}
