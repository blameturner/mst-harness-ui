export interface ComposerToggle {
  key: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}
