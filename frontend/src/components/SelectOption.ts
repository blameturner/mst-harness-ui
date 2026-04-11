export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  description?: string;
}
