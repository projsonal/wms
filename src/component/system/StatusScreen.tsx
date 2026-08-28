'use client';

import Link from 'next/link';
import {
  ShieldAlert,
  ShieldX,
  Compass,
  Clock,
  ServerCrash,
  Construction,
  Hourglass,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/component/ui/Button';

export type StatusCode =
  | '400'
  | '401'
  | '403'
  | '404'
  | '408'
  | '429'
  | '500'
  | '502'
  | '503'
  | '504';

interface StatusAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

interface StatusDef {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  defaultMessage: string;
}

const STATUS_DEFS: Record<StatusCode, StatusDef> = {
  '400': {
    icon: Compass,
    color: 'text-amber-600',
    bg: 'from-amber-50 to-amber-100',
    title: 'Permintaan Tidak Valid',
    defaultMessage: 'Permintaan yang dikirim tidak dapat diproses. Periksa kembali data yang diisi.',
  },
  '401': {
    icon: ShieldAlert,
    color: 'text-dangerText',
    bg: 'from-red-50 to-orange-50',
    title: 'Sesi Berakhir / Belum Masuk',
    defaultMessage:
      'Kamu belum masuk atau sesi sudah berakhir, jadi halaman ini tidak boleh diakses. Silakan masuk kembali.',
  },
  '403': {
    icon: ShieldX,
    color: 'text-dangerText',
    bg: 'from-red-50 to-rose-100',
    title: 'Akses Ditolak',
    defaultMessage:
      'Akun kamu tidak punya izin untuk membuka halaman ini. Kalau ini keliru, hubungi Super Admin untuk mengatur ulang hak akses.',
  },
  '404': {
    icon: Compass,
    color: 'text-accentDark',
    bg: 'from-accentSoft to-orange-50',
    title: 'Halaman Tidak Ditemukan',
    defaultMessage: 'Alamat yang dituju tidak ada atau sudah dipindahkan. Periksa kembali tautannya.',
  },
  '408': {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'from-amber-50 to-amber-100',
    title: 'Waktu Permintaan Habis',
    defaultMessage: 'Server tidak merespons tepat waktu. Periksa koneksi internet lalu coba lagi.',
  },
  '429': {
    icon: Hourglass,
    color: 'text-amber-600',
    bg: 'from-amber-50 to-amber-100',
    title: 'Terlalu Banyak Permintaan',
    defaultMessage: 'Kamu mengirim permintaan terlalu sering. Tunggu sebentar lalu coba lagi.',
  },
  '500': {
    icon: ServerCrash,
    color: 'text-dangerText',
    bg: 'from-red-50 to-orange-50',
    title: 'Terjadi Kesalahan Server',
    defaultMessage: 'Ada yang tidak beres di sisi server. Tim teknis sudah diberi tahu — coba lagi sesaat lagi.',
  },
  '502': {
    icon: Wifi,
    color: 'text-dangerText',
    bg: 'from-red-50 to-orange-50',
    title: 'Gateway Bermasalah',
    defaultMessage: 'Server tujuan mengirim respons yang tidak valid. Coba beberapa saat lagi.',
  },
  '503': {
    icon: Construction,
    color: 'text-amber-600',
    bg: 'from-amber-50 to-amber-100',
    title: 'Layanan Sedang Tidak Tersedia',
    defaultMessage: 'Server sedang sibuk atau dalam pemeliharaan singkat. Silakan coba lagi beberapa saat lagi.',
  },
  '504': {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'from-amber-50 to-amber-100',
    title: 'Gateway Waktu Habis',
    defaultMessage: 'Server tujuan tidak merespons tepat waktu. Periksa koneksi lalu coba lagi.',
  },
};

interface StatusScreenProps {
  code: StatusCode;

  message?: string;

  actions?: StatusAction[];
}

export function StatusScreen({ code, message, actions }: Readonly<StatusScreenProps>): React.JSX.Element {
  const def = STATUS_DEFS[code];
  const Icon = def.icon;
  const resolvedActions: StatusAction[] =
    actions ?? [{ label: 'Kembali ke Halaman Utama', href: '/login', variant: 'primary' }];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-16 text-center">
      <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${def.bg}`}>
        <Icon className={`h-11 w-11 ${def.color}`} strokeWidth={1.75} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className={`font-mono text-sm font-bold tracking-[0.2em] ${def.color}`}>KODE {code}</span>
        <h1 className="text-2xl font-bold text-text sm:text-3xl">{def.title}</h1>
        <p className="max-w-md text-sm text-textMuted">{message || def.defaultMessage}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {resolvedActions.map((action) =>
          action.href ? (
            <Link key={action.label} href={action.href}>
              <Button variant={action.variant ?? 'primary'}>{action.label}</Button>
            </Link>
          ) : (
            <Button key={action.label} variant={action.variant ?? 'primary'} onClick={action.onClick}>
              {action.label}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
