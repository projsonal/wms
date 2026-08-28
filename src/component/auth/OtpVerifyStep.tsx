import { OtpInput } from '@/component/auth/OtpInput';
import { Button } from '@/component/ui/Button';

interface OtpVerifyStepProps {
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
}

export function OtpVerifyStep({
  otp,
  onOtpChange,
  onVerify,
  isSubmitting,
  errorMessage,
}: Readonly<OtpVerifyStepProps>): React.JSX.Element {
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
