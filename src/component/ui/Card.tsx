import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={clsx(
        'rounded-lg border border-borderSoft bg-surface p-5 shadow-card transition-shadow duration-300',
        className,
      )}
      {...props}
    />
  );
}
