export type DiffRow =
  | { kind: 'same'; left: string; right: string }
  | { kind: 'add'; right: string }
  | { kind: 'del'; left: string };
