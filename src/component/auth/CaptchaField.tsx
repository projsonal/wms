import { Input } from '@/component/ui/FormControls';
import { Button } from '@/component/ui/Button';
import { Icon } from "@iconify/react";
import type { CaptchaChallenge } from '@/types';

interface CaptchaFieldProps {
  readonly challenge: CaptchaChallenge | null;
  readonly answer: string;
  readonly onAnswerChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function CaptchaField({
  challenge,
  answer,
  onAnswerChange,
  onRefresh,
  isRefreshing = false,
}: Readonly <CaptchaFieldProps>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex h-16 flex-1 items-center justify-center overflow-hidden rounded-md border border-borderSoft bg-white">
          {challenge ? (
            <img
              src={challenge.captchaImageBase64}
              alt="masukkan hasil perhitungan pada gambar"
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
          <Icon
            icon="lucide:refresh-cw"
            className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
          />
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