import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, htmlFor, error, children }: FieldWrapperProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps): React.JSX.Element {
  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <input
        id={id}
        className={clsx(
          'rounded-md border border-borderSoft bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent',
          error && 'border-dangerText',
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
}

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  id,
  options,
  placeholder,
  className,
  ...props
}: SelectProps): React.JSX.Element {
  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <select
        id={id}
        className={clsx(
          'rounded-md border border-borderSoft bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent',
          error && 'border-dangerText',
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
