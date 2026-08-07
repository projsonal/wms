import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Helper standar shadcn/ui untuk menggabungkan className dengan aman
 * (menyelesaikan konflik utility Tailwind seperti `px-2` vs `px-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
