import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export function FormInput({ label, className, ...inputProps }: FormInputProps) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
        {label}
      </span>
      <input
        {...inputProps}
        className={[
          'w-full bg-bg border border-border rounded-md px-3 py-2.5 text-[15px]',
          'placeholder:text-muted focus:outline-none focus:border-fg transition-colors',
          className ?? '',
        ].join(' ')}
      />
    </label>
  );
}
