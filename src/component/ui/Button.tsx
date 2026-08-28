import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { LoadingDots } from '@/component/ui/LoadingDots';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;

  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accentDark',
  secondary: 'bg-surface text-text border border-borderSoft hover:bg-surfaceAlt',
  ghost: 'bg-transparent text-accent hover:bg-accentSoft',
  danger: 'bg-dangerText text-white hover:opacity-90',
};

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {loading ? <LoadingDots /> : children}
    </button>
  );
}
