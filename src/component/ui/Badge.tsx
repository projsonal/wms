import clsx from 'clsx';
import type { StatusBadgeVariant } from '@/types';

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: 'bg-successBg text-successText',
  warning: 'bg-warningBg text-warningText',
  danger: 'bg-dangerBg text-dangerText',
  info: 'bg-infoBg text-infoText',
  neutral: 'bg-neutralBg text-neutralText',
};

interface BadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
}

export function Badge({ label, variant = 'neutral' }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
        VARIANT_CLASSES[variant],
      )}
    >
      {label}
    </span>
  );
}
