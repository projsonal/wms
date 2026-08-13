import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useIsMobileDevice } from '@/lib/hooks/use-mobile-device';

/**
 * Submit lewat tombol Enter — HANYA di laptop/komputer (deteksi
 * User-Agent asli lewat useIsMobileDevice, bukan lebar viewport). Di HP,
 * "Enter"/"Go" pada keyboard virtual sering dipakai untuk pindah baris
 * atau tidak konsisten antar keyboard, jadi sengaja tidak memicu submit
 * di sana — pengguna mobile tetap pakai tombol di layar.
 *
 * Dipasang di elemen pembungkus form (bukan per-input) supaya Enter dari
 * field mana pun di dalam form yang sama memicu submit, kecuali saat
 * fokus ada di dalam <textarea> (biarkan Enter bikin baris baru seperti
 * biasa) atau tombol/link (biarkan perilaku native-nya jalan).
 */
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
