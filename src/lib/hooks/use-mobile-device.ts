import { useEffect, useState } from 'react';

const MOBILE_UA_PATTERN =
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|webOS|BlackBerry/i;

/**
 * Deteksi PERANGKAT mobile sungguhan lewat User-Agent, beda dari cek lebar
 * viewport CSS (yang bisa salah kalau jendela browser desktop diperkecil).
 * Dipakai untuk fitur yang memang hanya relevan di perangkat fisik mobile,
 * misalnya tombol "Unduh Barcode QR" di layar setup 2FA — di HP, memindai
 * QR yang tampil di layar HP itu sendiri janggal, jadi lebih berguna
 * menawarkan unduh/simpan gambarnya.
 */
export function useIsMobileDevice(): boolean {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const ua = navigator.userAgent || '';
    // iPadOS 13+ melaporkan UA desktop Safari biasa, jadi ditambah cek
    // touch-capable untuk menangkap iPad juga.
    const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi sekali di mount, bukan reaksi state lain
    setIsMobileDevice(MOBILE_UA_PATTERN.test(ua) || isTouchMac);
  }, []);

  return isMobileDevice;
}
