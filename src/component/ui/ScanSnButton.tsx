'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { Modal } from '@/component/ui/Modal';
import { Button } from '@/component/ui/Button';

export function ScanSnButton({ onScan }: { onScan: (value: string) => void }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isInsecureContext, setIsInsecureContext] = useState(false);
  const [engine, setEngine] = useState<'checking' | 'native' | 'polyfill' | 'unavailable'>('checking');
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);

  function stopCamera(): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
  }

  useEffect(() => {
    if (!isOpen) return;

    if (!window.isSecureContext) {
      setIsInsecureContext(true);
      return;
    }
    setIsInsecureContext(false);
    setEngine('checking');
    setError('');
    let cancelled = false;

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;

    async function startNative(): Promise<void> {
      setEngine('native');

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // Diamkan — beberapa browser mobile butuh interaksi user
            // lagi sebelum autoplay video jalan, video tetap tampil.
          });
        }

        async function tick(): Promise<void> {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onScan(codes[0].rawValue);
              stopCamera();
              setIsOpen(false);
              return;
            }
          } catch {
            // Frame belum siap/tidak valid — coba lagi di frame berikutnya,
            // bukan error fatal.
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError('Tidak bisa mengakses kamera — cek izin kamera di browser, atau ketik SN manual.');
      }
    }

    async function startPolyfill(): Promise<void> {
      setEngine('polyfill');
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              onScan(result.getText());
              stopCamera();
              setIsOpen(false);
            }
            // Kalau result null (belum ketemu kode di frame ini) atau
            // error decode biasa, @zxing/browser OTOMATIS lanjut ke
            // frame berikutnya sendiri — tidak perlu di-drive manual
            // seperti jalur native (beda dari pola requestAnimationFrame
            // di atas, ini semua sudah ditangani library-nya).
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch {
        if (!cancelled) setError('Tidak bisa mengakses kamera — cek izin kamera di browser, atau ketik SN manual.');
      }
    }

    if (BarcodeDetectorCtor) {
      startNative();
    } else {

      startPolyfill();
    }

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onScan sengaja tidak dijadikan dependency, dibaca lewat closure terbaru
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Scan SN pakai kamera"
        className="flex items-center gap-1 rounded-md border border-borderSoft px-2 py-1.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accentDark"
      >
        <ScanLine className="h-3.5 w-3.5" /> Scan
      </button>

      <Modal
        isOpen={isOpen}
        title="Scan Nomor Seri"
        onClose={() => {
          stopCamera();
          setIsOpen(false);
        }}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              stopCamera();
              setIsOpen(false);
            }}
          >
            Batal — ketik manual saja
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {isInsecureContext ? (
            <p className="rounded-md bg-warningBg px-3 py-2 text-xs text-warningText">
              Halaman ini dibuka lewat koneksi HTTP biasa (bukan HTTPS) — browser MEMATIKAN akses
              kamera untuk situs seperti ini demi keamanan, bukan soal HP/browsernya tidak mampu.
              Perbaikannya: minta admin mengaktifkan HTTPS untuk aplikasi ini, atau kalau sedang
              testing di jaringan kantor/lokal, buka <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> di
              Chrome, tambahkan alamat situs ini, lalu restart Chrome. Sementara itu, ketik nomor
              serinya secara manual di field yang tersedia.
            </p>
          ) : error ? (
            <p className="rounded-md bg-dangerBg px-3 py-2 text-xs text-dangerText">{error}</p>
          ) : (
            <>
              <p className="text-xs text-textMuted">
                Arahkan kamera ke stiker QR/barcode berisi SN di badan unit fisik. Deteksi otomatis
                begitu kode terbaca jelas.
                {engine === 'polyfill' ? ' (mode kompatibilitas — decoder JavaScript, sedikit lebih lambat dari kamera native tapi jalan di semua browser)' : ''}
              </p>
              <div className="relative overflow-hidden rounded-md bg-black">

                <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setIsOpen(false);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                  aria-label="Tutup kamera"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
