import { CaptchaField } from '@/component/auth/CaptchaField';
import { Input } from '@/component/ui/FormControls';
import type { CaptchaChallenge, RegisterPayload } from '@/types';

interface RegisterStepProps {
  values: RegisterPayload;
  errors?: Partial<Record<string, string>>;
  onChange: (values: RegisterPayload) => void;
  captcha: CaptchaChallenge | null;
  onRefreshCaptcha: () => void;
}

export function RegisterStep({
  values,
  errors,
  onChange,
  captcha,
  onRefreshCaptcha,
}: RegisterStepProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Input
        id="fullName"
        label="Nama Lengkap"
        placeholder="Nama lengkap kamu"
        value={values.fullName}
        onChange={(event) => onChange({ ...values, fullName: event.target.value })}
        error={errors?.fullname}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="username"
          label="Username"
          placeholder="Minimal 4 karakter"
          value={values.username}
          onChange={(event) => onChange({ ...values, username: event.target.value })}
          error={errors?.username}
          autoComplete="username"
        />
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="nama@email.com"
          value={values.email}
          onChange={(event) => onChange({ ...values, email: event.target.value })}
          error={errors?.email}
          autoComplete="email"
        />
      </div>
      <Input
        id="phoneNumber"
        label="Nomor HP (opsional, format +62...)"
        placeholder="+6281234567890"
        value={values.phoneNumber ?? ''}
        onChange={(event) => onChange({ ...values, phoneNumber: event.target.value })}
        error={errors?.phonenumber}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Minimal 8 karakter"
          value={values.password}
          onChange={(event) => onChange({ ...values, password: event.target.value })}
          error={errors?.password}
          autoComplete="new-password"
        />
        <Input
          id="passwordConfirmation"
          label="Konfirmasi Password"
          type="password"
          placeholder="Ulangi password"
          value={values.passwordConfirmation}
          onChange={(event) => onChange({ ...values, passwordConfirmation: event.target.value })}
          error={errors?.passwordconfirmation}
          autoComplete="new-password"
        />
      </div>
      <CaptchaField
        challenge={captcha}
        answer={values.captchaAnswer}
        onAnswerChange={(value) => onChange({ ...values, captchaAnswer: value })}
        onRefresh={onRefreshCaptcha}
      />
    </div>
  );
}
