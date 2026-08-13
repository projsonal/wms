import clsx from 'clsx';
import { Crown, ShieldCheck, HardHat } from 'lucide-react';
import { ROLE_OPTIONS, ROLE_LABEL } from '@/auth/roles';
import type { UserRole } from '@/types';

interface RoleSelectStepProps {
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

/** Ikon per role — dipilih supaya langsung intuitif tanpa perlu baca label:
 * mahkota untuk pemegang akses penuh, perisai untuk pengelola operasional,
 * helm proyek untuk pekerja lapangan/gudang. */
const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  super_admin: Crown,
  admin: ShieldCheck,
  karyawan: HardHat,
};

export function RoleSelectStep({ selectedRole, onSelectRole }: RoleSelectStepProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div>
        <h2 className="text-base font-semibold text-text">Pilih Role Kamu</h2>
        <p className="text-xs text-textMuted">
          Tampilan &amp; Fitur sesuai kebutuhan role yang dipilih
        </p>
        <p className="mt-1 text-[11px] text-textMuted">
          Backend hanya menerapkan pilihan ini di lingkungan non-production — di production,
          akun baru selalu dibuat sebagai <strong>Karyawan</strong> dan role lain diberikan oleh
          Super Admin lewat menu Manajemen User.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {ROLE_OPTIONS.map((option) => {
          const isActive = option.role === selectedRole;
          const RoleIcon = ROLE_ICON[option.role];
          return (
            <button
              key={option.role}
              type="button"
              onClick={() => onSelectRole(option.role)}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-md border px-2 py-4 text-xs transition-colors',
                isActive
                  ? 'border-accentDark bg-accentDark text-white'
                  : 'border-borderSoft bg-surface text-text hover:border-accent',
              )}
            >
              <span
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-neutralBg text-accentDark',
                )}
              >
                <RoleIcon className="h-4.5 w-4.5" />
              </span>
              <span className="font-semibold">{ROLE_LABEL[option.role]}</span>
              <span className={clsx('leading-snug', isActive ? 'text-white/80' : 'text-textMuted')}>
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
