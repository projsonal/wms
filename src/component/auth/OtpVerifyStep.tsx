import { OtpInput } from '@/component/auth/OtpInput';
import { Button } from '@/component/ui/Button';
import type { OtpMethod } from '@/types';

interface OtpVerifyStepProps {
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  isSubmitting: boolean;
  method: OtpMethod;
  /** Aktif kalau kode WhatsApp baru saja diminta (mengunci tombol supaya tidak spam kirim ulang). */
  isRequestingWhatsapp: boolean;
  onRequestWhatsapp: () => void;
  errorMessage?: string | null;
}

/**
 * Backend gostock mendukung dua metode verifikasi OTP saat login
 * (VerifyOTPRequest.method): "totp" (kode 6 digit dari Google Authenticator,
 * berubah tiap 30 detik, tanpa perlu request eksplisit) atau "whatsapp"
 * (kode dikirim ke nomor HP terdaftar via POST /auth/otp/request lebih
 * dulu, dan wajib menyertakan `otp_token` dari respons request tersebut).
 */
export function OtpVerifyStep({
  otp,
  onOtpChange,
  onVerify,
  isSubmitting,
  method,
  isRequestingWhatsapp,
  onRequestWhatsapp,
  errorMessage,
}: OtpVerifyStepProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div>
        <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-text">
          <span aria-hidden className="text-dangerText">
            🛡
          </span>
          Verifikasi Identitas Kamu
        </h2>
        <p className="mt-1 text-xs text-textMuted">
          {method === 'whatsapp'
            ? 'Masukkan 6 digit kode OTP yang dikirim lewat WhatsApp.'
            : 'Masukkan 6 digit kode OTP dari aplikasi Google Authenticator.'}
        </p>
      </div>
      {method === 'totp' ? (
        <p className="text-xs text-textMuted">
          Kode berubah setiap 30 detik. Pastikan kamu memasukkan kode yang terbaru.
        </p>
      ) : null}
      <OtpInput value={otp} onChange={onOtpChange} />
      {errorMessage ? <p className="text-xs text-dangerText">{errorMessage}</p> : null}
      <Button onClick={onVerify} disabled={isSubmitting || otp.length < 6}>
        Verifikasi
      </Button>
      {method === 'totp' ? (
        <button
          type="button"
          onClick={onRequestWhatsapp}
          disabled={isRequestingWhatsapp}
          className="text-xs text-textMuted underline disabled:opacity-50"
        >
          Tidak punya akses ke Authenticator? Kirim kode lewat WhatsApp
        </button>
      ) : (
        <button
          type="button"
          onClick={onRequestWhatsapp}
          disabled={isRequestingWhatsapp}
          className="text-xs text-textMuted underline disabled:opacity-50"
        >
          Kirim ulang kode WhatsApp
        </button>
      )}
    </div>
  );
}
