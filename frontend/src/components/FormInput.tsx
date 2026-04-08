import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export function FormInput({ label, ...inputProps }: FormInputProps) {
  return (
    <label className="block">
      <span className="block text-sm text-muted mb-1">{label}</span>
      <input
        {...inputProps}
        className="w-full bg-panel border border-border px-3 py-2 rounded focus:border-accent outline-none"
      />
    </label>
  );
}
