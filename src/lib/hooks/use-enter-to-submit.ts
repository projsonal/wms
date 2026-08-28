import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useIsMobileDevice } from '@/lib/hooks/use-mobile-device';

export function useEnterToSubmit(
  onSubmit: () => void,
  options?: { disabled?: boolean },
): (event: KeyboardEvent<HTMLDivElement>) => void {
  const isMobileDevice = useIsMobileDevice();
  const disabled = options?.disabled ?? false;

  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isMobileDevice || disabled || event.key !== 'Enter') {
        return;
      }
      const target = event.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') {
        return;
      }
      event.preventDefault();
      onSubmit();
    },
    [isMobileDevice, disabled, onSubmit],
  );
}
