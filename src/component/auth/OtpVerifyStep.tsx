import { OtpInput } from '@/component/auth/OtpInput';
import { Button } from '@/component/ui/Button';

interface OtpVerifyStepProps {
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
}

/**
 * Verifikasi 2FA login — HANYA metode TOTP (kode 6 digit dari Google
 * Authenticator, berubah tiap 30 detik). Metode fallback OTP lewat
 * WhatsApp sudah dihapus (tidak reliabel di produksi); satu-satunya cara
 * mengaktifkan 2FA tetap lewat Settings -> Keamanan -> Aktifkan 2FA.
 */
export function OtpVerifyStep({
  otp,
  onOtpChange,
  onVerify,
  isSubmitting,
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
          Masukkan 6 digit kode OTP dari aplikasi Google Authenticator.
        </p>
      </div>
      <p className="text-xs text-textMuted">
        Kode berubah setiap 30 detik. Pastikan kamu memasukkan kode yang terbaru.
      </p>
      <OtpInput value={otp} onChange={onOtpChange} />
      {errorMessage ? <p className="text-xs text-dangerText">{errorMessage}</p> : null}
      <Button onClick={onVerify} loading={isSubmitting} disabled={otp.length < 6}>
        Verifikasi
      </Button>
    </div>
  );
}
