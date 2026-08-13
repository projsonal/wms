'use client';

import { useEffect, useState } from 'react';
import { Input, PasswordInput } from '@/component/ui/FormControls';
import { authApi } from '@/lib/api/auth';
import type { RegisterPayload } from '@/types';

interface RegisterStepProps {
  values: RegisterPayload;
  errors?: Partial<Record<string, string>>;
  onChange: (values: RegisterPayload) => void;
}

type UsernameCheckState = 'idle' | 'checking' | 'available' | 'taken';

const USERNAME_CHECK_DEBOUNCE_MS = 500;

/**
 * Alert live "username sudah dipakai" — dicek dengan debounce ke
 * GET /auth/username-available setiap user berhenti mengetik sejenak,
 * supaya ketahuan SEBELUM submit form (bukan baru setelah submit gagal
 * dengan error 409 dari backend).
 */
function useUsernameAvailability(username: string): UsernameCheckState {
  const trimmed = username.trim();
  const [state, setState] = useState<UsernameCheckState>('idle');

  useEffect(() => {
    if (trimmed.length < 4) {
      // Tidak perlu setState di sini -- nilai "idle" untuk kasus ini
      // sudah ditangani lewat turunan di baris return di bawah, jadi
      // effect ini tidak perlu terpicu genap untuk username pendek.
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- menandai "sedang mengecek" sebelum memulai pengecekan async (debounce+fetch) di bawah, pola yang sama dipakai di banyak tempat lain pada codebase ini
    setState('checking');
    const timer = setTimeout(() => {
      authApi
        .checkUsernameAvailability(trimmed)
        .then((res) => setState(res.available ? 'available' : 'taken'))
        .catch(() => setState('idle')); // gagal cek (mis. bot-check) -> diam saja, jangan ganggu form
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  return trimmed.length < 4 ? 'idle' : state;
}

function usernameHintFor(state: UsernameCheckState): string | undefined {
  switch (state) {
    case 'checking':
      return 'Mengecek ketersediaan username...';
    case 'taken':
      return 'Username ini sudah dipakai, coba yang lain.';
    case 'available':
      return 'Username tersedia.';
    default:
      return undefined;
  }
}

function usernameHintClassName(state: UsernameCheckState): string {
  if (state === 'taken') return 'text-xs text-dangerText';
  if (state === 'available') return 'text-xs text-successText';
  return 'text-xs text-textMuted';
}

export function RegisterStep({ values, errors, onChange }: RegisterStepProps): React.JSX.Element {
  const usernameCheck = useUsernameAvailability(values.username);
  const usernameHint = usernameHintFor(usernameCheck);

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
      <div className="flex flex-col gap-1">
        <Input
          id="username"
          label="Username"
          placeholder="Minimal 4 karakter"
          value={values.username}
          onChange={(event) => onChange({ ...values, username: event.target.value })}
          error={errors?.username ?? (usernameCheck === 'taken' ? ' ' : undefined)}
          autoComplete="username"
        />
        {usernameHint ? (
          <p className={usernameHintClassName(usernameCheck)}>{usernameHint}</p>
        ) : null}
      </div>
      <Input
        id="phoneNumber"
        label="Nomor HP (opsional, hanya sebagai data)"
        placeholder="+6281234567890"
        value={values.phoneNumber ?? ''}
        onChange={(event) => onChange({ ...values, phoneNumber: event.target.value })}
        error={errors?.phonenumber}
        autoComplete="tel"
      />
      <div className="grid grid-cols-2 gap-4">
        <PasswordInput
          id="password"
          label="Password"
          placeholder="Minimal 8 karakter"
          value={values.password}
          onChange={(event) => onChange({ ...values, password: event.target.value })}
          error={errors?.password}
          autoComplete="new-password"
        />
        <PasswordInput
          id="passwordConfirmation"
          label="Konfirmasi Password"
          placeholder="Ulangi password"
          value={values.passwordConfirmation}
          onChange={(event) => onChange({ ...values, passwordConfirmation: event.target.value })}
          error={errors?.passwordconfirmation}
          autoComplete="new-password"
        />
      </div>
    </div>
  );
}
