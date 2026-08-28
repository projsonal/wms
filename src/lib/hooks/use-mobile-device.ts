import { useEffect, useState } from 'react';

const MOBILE_UA_PATTERN =
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|webOS|BlackBerry/i;

export function useIsMobileDevice(): boolean {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const ua = navigator.userAgent || '';

    const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

    setIsMobileDevice(MOBILE_UA_PATTERN.test(ua) || isTouchMac);
  }, []);

  return isMobileDevice;
}
