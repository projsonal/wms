import type { AuthUser, UserRole } from '@/types';

const DEMO_USER_KEY = 'stockrsd_demo_user';

export const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE !== 'false';

const DEMO_NAMES: Record<UserRole, string> = {
  super_admin: 'Zahra Putri',
  admin: 'Rizky Ardiansyah',
  karyawan: 'Dewi Lestari',
};

const DEMO_ROLE_ID: Record<UserRole, number> = {
  super_admin: 1,
  admin: 2,
  karyawan: 3,
};

export function buildDemoUser(role: UserRole): AuthUser {
  const username = DEMO_NAMES[role].toLowerCase().replace(/\s+/g, '.');
  return {
    id: DEMO_ROLE_ID[role],
    fullName: DEMO_NAMES[role],
    username,
    email: `${username}@stockrsd.id`,
    phoneNumber: '+6281200000000',
    roleId: DEMO_ROLE_ID[role],
    role,
    twoFactorEnabled: true,
  };
}

export function getDemoUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(DEMO_USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function setDemoUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (user) {
    window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(DEMO_USER_KEY);
  }
}
