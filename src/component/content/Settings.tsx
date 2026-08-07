'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Button } from '@/component/ui/Button';
import { Input } from '@/component/ui/FormControls';
import { useAuth } from '@/auth/AuthContext';
import { ROLE_LABEL } from '@/auth/roles';
import { authApi } from '@/lib/api/auth';
import { accountApi } from '@/lib/api/account';
import { HttpError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import type { SessionInfo } from '@/types';

type SettingsTab = 'profil' | 'notifikasi' | 'keamanan' | 'tampilan' | 'sistem';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'notifikasi', label: 'Notifikasi' },
  { id: 'keamanan', label: 'Keamanan' },
  { id: 'tampilan', label: 'Tampilan' },
  { id: 'sistem', label: 'Sistem' },
];

function ToggleRow({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.JSX.Element {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="flex items-center justify-between border-b border-borderSoft py-4 last:border-0">
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-xs text-textMuted">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        aria-pressed={enabled}
        aria-label={title}
        className={clsx('h-6 w-11 rounded-full transition-colors', enabled ? 'bg-accent' : 'bg-neutralBg')}
      >
        <span
          className={clsx(
            'block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function ProfileTab(): React.JSX.Element {
  const { user } = useAuth();
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Profil</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Nama Lengkap" defaultValue={user?.fullName ?? ''} />
        <Input label="Username" defaultValue={user?.username ?? ''} readOnly />
        <Input label="Email" type="email" defaultValue={user?.email ?? ''} />
        <Input label="Nomor HP" defaultValue={user?.phoneNumber ?? ''} />
        <Input label="Role" defaultValue={user ? ROLE_LABEL[user.role] : ''} readOnly />
      </div>
      <div>
        <Button>Simpan Perubahan</Button>
      </div>
    </Card>
  );
}

function NotificationTab(): React.JSX.Element {
  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Preferensi Notifikasi</h2>
      <p className="mb-2 text-xs text-textMuted">
        Preferensi di bawah ini belum tersambung ke backend gostock (belum ada modulnya) —
        tersimpan lokal di perangkat untuk sekarang.
      </p>
      <ToggleRow title="Notifikasi Email" description="Kirim ringkasan aktivitas gudang harian" />
      <ToggleRow title="Notifikasi WhatsApp" description="Kirim peringatan stok kritis via WhatsApp" />
      <ToggleRow
        title="Peringatan Stok Minimum"
        description="Beri tahu saat stok barang di bawah ambang batas"
      />
    </Card>
  );
}

function SessionsCard(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  async function loadSessions(): Promise<void> {
    try {
      const res = await authApi.listSessions();
      setSessions(res.sessions);
    } catch {
      setError('Gagal memuat riwayat login.');
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadSessions async, lihat AuthContext untuk pola serupa
    loadSessions();
  }, []);

  async function handleRevoke(id?: number): Promise<void> {
    if (!id) return;
    setRevokingId(id);
    try {
      await authApi.revokeSession(id);
      await loadSessions();
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-text">Riwayat Login</h2>
      <p className="text-xs text-textMuted">Perangkat yang sedang aktif dengan sesi login kamu.</p>
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
      {sessions?.length === 0 ? <p className="text-xs text-textMuted">Belum ada sesi lain.</p> : null}
      {(sessions ?? []).map((session) => (
        <div
          key={`${session.id ?? session.createdAt}`}
          className="flex items-center justify-between gap-3 border-b border-borderSoft pb-3 last:border-0"
        >
          <div>
            <p className="text-sm font-semibold text-text">
              {session.browser} {session.browserVersion} · {session.os} {session.osVersion}
            </p>
            <p className="text-xs text-textMuted">
              {session.location} · {session.ipAddress}
              {session.createdAt ? ` · ${formatDate(session.createdAt)}` : ''}
            </p>
          </div>
          {session.id ? (
            <Button
              variant="secondary"
              onClick={() => handleRevoke(session.id)}
              disabled={revokingId === session.id}
            >
              Cabut
            </Button>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

function ChangePasswordCard(): React.JSX.Element {
  const [phase, setPhase] = useState<'request' | 'confirm'>('request');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await accountApi.requestChangePasswordOtp(oldPassword);
      setOtpToken(res.otpToken);
      setPhase('confirm');
      setMessage('Kode OTP telah dikirim lewat WhatsApp ke nomor terdaftar.');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Password saat ini salah.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await accountApi.confirmChangePassword({ otpToken, otpCode, newPassword });
      setMessage('Password berhasil diubah.');
      setPhase('request');
      setOldPassword('');
      setNewPassword('');
      setOtpCode('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Kode OTP salah atau kedaluwarsa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Ubah Kata Sandi</h2>
      <p className="text-xs text-textMuted">
        Demi keamanan, perubahan password harus dikonfirmasi lewat kode OTP WhatsApp.
      </p>
      {phase === 'request' ? (
        <>
          <Input
            label="Password Saat Ini"
            type="password"
            placeholder="********"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
          />
          {error ? <p className="text-xs text-dangerText">{error}</p> : null}
          <div>
            <Button onClick={handleRequestOtp} disabled={isSubmitting || !oldPassword}>
              Kirim Kode OTP
            </Button>
          </div>
        </>
      ) : (
        <>
          <Input
            label="Password Baru"
            type="password"
            placeholder="Minimal 8 karakter"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Input
            label="Kode OTP WhatsApp"
            placeholder="6 digit"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
          />
          {error ? <p className="text-xs text-dangerText">{error}</p> : null}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setPhase('request')} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting || otpCode.length < 6 || !newPassword}>
              Simpan Password Baru
            </Button>
          </div>
        </>
      )}
      {message ? <p className="text-xs text-successText">{message}</p> : null}
    </Card>
  );
}

function SecurityTab(): React.JSX.Element {
  const { user } = useAuth();
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-1">
          <h2 className="mb-1 text-base font-semibold text-text">Keamanan Akun</h2>
          <div className="flex items-center justify-between border-b border-borderSoft py-3">
            <div>
              <p className="text-sm font-semibold text-text">Two-Factor Authentication (2FA)</p>
              <p className="text-xs text-textMuted">
                Wajib aktif untuk semua akun — diaktifkan sekali saat login pertama kali dan
                tidak bisa dimatikan sendiri lewat halaman ini.
              </p>
            </div>
            <span className="rounded-full bg-successBg px-3 py-1 text-xs font-semibold text-successText">
              {user?.twoFactorEnabled ? 'Aktif' : 'Belum aktif'}
            </span>
          </div>
          <ToggleRow
            title="Notifikasi Login Baru"
            description="Kirim email saat ada login dari perangkat baru (preferensi lokal)"
          />
          <ToggleRow
            title="Sesi Otomatis Logout"
            description="Logout otomatis setelah 30 menit tidak aktif (preferensi lokal)"
          />
        </Card>
        <ChangePasswordCard />
      </div>
      <div className="flex flex-col gap-4">
        <SessionsCard />
      </div>
    </div>
  );
}

function AppearanceTab(): React.JSX.Element {
  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Tampilan</h2>
      <ToggleRow title="Mode Gelap" description="Gunakan tema gelap pada seluruh halaman" />
      <ToggleRow title="Sidebar Ringkas" description="Ciutkan label menu, tampilkan ikon saja" />
    </Card>
  );
}

function SystemTab(): React.JSX.Element {
  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Sistem</h2>
      <ToggleRow
        title="Sinkronisasi Otomatis"
        description="Sinkronkan data dengan backend gostock setiap 5 menit"
      />
      <ToggleRow title="Mode Pemeliharaan" description="Nonaktifkan sementara akses non-Super Admin" />
    </Card>
  );
}

export function SettingsContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');

  return (
    <PageShell title="Settings" breadcrumb="Settings">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-lg font-bold text-text">Settings</h2>
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  activeTab === tab.id ? 'bg-accent text-white' : 'text-textMuted hover:bg-surfaceAlt',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'profil' ? <ProfileTab /> : null}
        {activeTab === 'notifikasi' ? <NotificationTab /> : null}
        {activeTab === 'keamanan' ? <SecurityTab /> : null}
        {activeTab === 'tampilan' ? <AppearanceTab /> : null}
        {activeTab === 'sistem' ? <SystemTab /> : null}
      </div>
    </PageShell>
  );
}
