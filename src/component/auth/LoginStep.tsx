import { Input, PasswordInput } from '@/component/ui/FormControls';
import type { LoginPayload } from '@/types';

interface LoginStepProps {
  readonly values: LoginPayload;
  readonly errors?: Partial<Record<keyof LoginPayload, string>>;
  onChange: (values: LoginPayload) => void;
}

export function LoginStep({ values, errors, onChange }: Readonly <LoginStepProps>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Input
        id="username"
        label="Username"
        placeholder="Masukkan username"
        value={values.username}
        onChange={(event) => onChange({ ...values, username: event.target.value })}
        error={errors?.username}
        autoComplete="username"
      />
      <PasswordInput
        id="password"
        label="Password"
        placeholder="Masukkan password"
        value={values.password}
        onChange={(event) => onChange({ ...values, password: event.target.value })}
        error={errors?.password}
        autoComplete="current-password"
      />
    </div>
  );
}
