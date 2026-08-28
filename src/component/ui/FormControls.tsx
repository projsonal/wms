import clsx from 'clsx';
import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export function PasswordInput({
  label,
  error,
  id,
  className,
  autoComplete,
  ...props
}: PasswordInputProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={clsx(
            'w-full rounded-md border border-borderSoft bg-surface px-4 py-2.5 pr-11 text-sm text-text outline-none transition-colors focus:border-accent',
            error && 'border-dangerText',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          tabIndex={-1}
          aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted transition-colors hover:text-text"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FieldWrapper>
  );
}

interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  value: number;
  onValueChange: (value: number) => void;
}

export function NumberField({
  label,
  error,
  id,
  className,
  value,
  onValueChange,
  ...props
}: NumberFieldProps): React.JSX.Element {
  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value === 0 ? '0' : String(value)}
        onChange={(event) => {
          const digitsOnly = event.target.value.replace(/\D/g, '');
          onValueChange(digitsOnly === '' ? 0 : Number(digitsOnly));
        }}
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

interface CurrencyFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  value: number;
  onValueChange: (value: number) => void;
}

export function CurrencyField({
  label,
  error,
  id,
  className,
  value,
  onValueChange,
  ...props
}: CurrencyFieldProps): React.JSX.Element {
  const formatted = value ? `Rp ${value.toLocaleString('id-ID')}` : 'Rp 0';

  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={(event) => {
          const digitsOnly = event.target.value.replace(/\D/g, '');
          onValueChange(digitsOnly === '' ? 0 : Number(digitsOnly));
        }}
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

interface SelectWithCreateProps {
  label?: string;
  error?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];

  createLabel: string;

  secondaryFieldLabel?: string;

  onCreate: (nama: string, secondary?: string) => Promise<SelectOption>;
}

const CREATE_NEW_SENTINEL = '__create_new__';

export function SelectWithCreate({
  label,
  error,
  id,
  className,
  placeholder,
  value,
  onChange,
  options,
  createLabel,
  secondaryFieldLabel,
  onCreate,
}: SelectWithCreateProps): React.JSX.Element {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSecondary, setNewSecondary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleCreateSubmit(): Promise<void> {
    if (!newName.trim()) {
      setCreateError('Nama wajib diisi.');
      return;
    }
    setIsSaving(true);
    setCreateError('');
    try {
      const created = await onCreate(newName.trim(), newSecondary.trim() || undefined);
      onChange(created.value);
      setIsCreating(false);
      setNewName('');
      setNewSecondary('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FieldWrapper label={label} htmlFor={id} error={error}>
      <select
        id={id}
        value={isCreating ? CREATE_NEW_SENTINEL : value}
        onChange={(event) => {
          if (event.target.value === CREATE_NEW_SENTINEL) {
            setIsCreating(true);
            return;
          }
          onChange(event.target.value);
        }}
        className={clsx(
          'rounded-md border border-borderSoft bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent',
          error && 'border-dangerText',
          className,
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CREATE_NEW_SENTINEL}>{createLabel}</option>
      </select>

      {isCreating ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-accent/50 bg-neutralBg p-3">
          <div className={clsx('grid gap-2', secondaryFieldLabel ? 'grid-cols-2' : 'grid-cols-1')}>
            <Input
              label="Nama"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            {secondaryFieldLabel ? (
              <Input
                label={secondaryFieldLabel}
                value={newSecondary}
                onChange={(e) => setNewSecondary(e.target.value)}
              />
            ) : null}
          </div>
          {createError ? <p className="text-xs text-dangerText">{createError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setCreateError('');
                setNewName('');
                setNewSecondary('');
              }}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-textMuted hover:bg-surface"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isSaving}
              className="rounded-md bg-accentDark px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent disabled:opacity-60"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      ) : null}
    </FieldWrapper>
  );
}
