import { Input } from '@/component/ui/FormControls';
import { Button } from '@/component/ui/Button';
import type { CaptchaChallenge } from '@/types';

interface CaptchaFieldProps {
  challenge: CaptchaChallenge | null;
  answer: string;
  onAnswerChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

/**
 * Menampilkan gambar CAPTCHA soal-matematika self-hosted milik backend
 * gostock (pkg/captcha) beserta input jawaban. Backend TIDAK PERNAH
 * mengirim jawabannya — satu-satunya cara menjawab adalah membaca gambar.
 */
export function CaptchaField({
  challenge,
  answer,
  onAnswerChange,
  onRefresh,
  isRefreshing = false,
}: CaptchaFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex h-16 flex-1 items-center justify-center overflow-hidden rounded-md border border-borderSoft bg-white">
          {challenge ? (
            // eslint-disable-next-line @next/next/no-img-element -- gambar base64 dari backend
            <img
              src={challenge.captchaImageBase64}
              alt="Soal CAPTCHA — masukkan hasil perhitungan pada gambar"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs text-textMuted">Memuat captcha...</span>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Muat ulang captcha"
        >
          ↻
        </Button>
      </div>
      <Input
        label="Jawaban Captcha"
        placeholder="Masukkan hasil perhitungan pada gambar"
        value={answer}
        onChange={(event) => onAnswerChange(event.target.value)}
        inputMode="numeric"
      />
    </div>
  );
}
