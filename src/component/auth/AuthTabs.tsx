'use client';

import Link from 'next/link';
import clsx from 'clsx';

interface AuthTabsProps {
  active: 'login' | 'register';
}

export function AuthTabs({ active }: Readonly<AuthTabsProps>): React.JSX.Element {
  return (
    <div className="mb-5 flex rounded-full bg-black/10 p-1">
      <Link
        href="/login"
        className={clsx(
          'flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors',
          active === 'login' ? 'bg-white text-accentDark shadow-sm' : 'text-white/75 hover:text-white',
        )}
      >
        Masuk
      </Link>
      <Link
        href="/register"
        className={clsx(
          'flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors',
          active === 'register' ? 'bg-white text-accentDark shadow-sm' : 'text-white/75 hover:text-white',
        )}
      >
        Daftar
      </Link>
    </div>
  );
}
