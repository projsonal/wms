'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { isAssetNotifEnabled, setAssetNotifEnabled } from '@/lib/notifications-context';
import clsx from 'clsx';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Button } from '@/component/ui/Button';
import { Input } from '@/component/ui/FormControls';
import { TwoFactorSetupStep } from '@/component/auth/TwoFactorSetupStep';
import { CaptchaField } from '@/component/auth/CaptchaField';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePreferences, FONT_LABEL } from '@/component/preferences/PreferencesContext';
import { useSidebarState } from '@/component/layout/SidebarContext';
import { ROLE_LABEL } from '@/auth/roles';
import { authApi } from '@/lib/api/auth';
import { accountApi } from '@/lib/api/account';
import { maintenanceApi, type MaintenanceStatus } from '@/lib/api/modules';
import { captchaApi } from '@/lib/api/security';
import { HttpError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import type { CaptchaChallenge, SessionInfo } from '@/types';

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
  checked,
  onChange,
}: {
  title: string;
  description: string;
  /** Kalau diisi, komponen jadi controlled (state dikelola pemanggil). */
  checked?: boolean;
  onChange?: (next: boolean) => void;
}): React.JSX.Element {
  const [localEnabled, setLocalEnabled] = useState(true);
  const enabled = checked ?? localEnabled;

  function handleClick(): void {
    const next = !enabled;
    if (onChange) {
      onChange(next);
    } else {
      setLocalEnabled(next);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-borderSoft py-4 last:border-0">
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-xs text-textMuted">{description}</p>
      </div>
      <button
        type="button"
        onClick={handleClick}
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
  const [assetNotifEnabled, setAssetNotifEnabledState] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi tersimpan sekali saat mount
    setAssetNotifEnabledState(isAssetNotifEnabled());
  }, []);

  function handleToggleAssetNotif(next: boolean): void {
    setAssetNotifEnabledState(next);
    setAssetNotifEnabled(next);
    toast.success(next ? 'Notifikasi aset diaktifkan.' : 'Notifikasi aset dimatikan.');
  }

  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Preferensi Notifikasi</h2>
      <p className="mb-2 text-xs text-textMuted">
        Preferensi di bawah ini tersimpan lokal di perangkat ini.
      </p>
      <ToggleRow
        title="Notifikasi Aset & Barang Rusak"
        description="Tampilkan alert real-time saat ada aset baru ditambahkan atau laporan barang rusak masuk"
        checked={assetNotifEnabled}
        onChange={handleToggleAssetNotif}
      />
      <ToggleRow
        title="Peringatan Stok Minimum"
        description="Beri tahu saat stok barang di bawah ambang batas"
      />
    </Card>
  );
}

function SessionsCard(): React.JSX.Element {
  const router = useRouter();
  const { logout } = useAuth();
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
      const res = await authApi.revokeSession(id);
      if (res.revoked_current) {
        // Sesi yang sedang dipakai browser ini sendiri baru saja dicabut —
        // access token yang ada tidak berguna lagi, langsung logout &
        // kembali ke halaman login.
        toast('Sesi ini baru saja dicabut, kamu akan keluar otomatis.');
        await logout();
        router.push('/login');
        return;
      }
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
              {session.isCurrent ? (
                <span className="ml-2 rounded-full bg-accentSoft px-2 py-0.5 text-[10px] font-semibold text-accentDark">
                  Perangkat ini
                </span>
              ) : null}
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
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadCaptcha(): Promise<void> {
    setIsRefreshingCaptcha(true);
    try {
      const c = await captchaApi.generate();
      setChallenge(c);
      setCaptchaAnswer('');
      setError(null);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Gagal memuat captcha — server backend tidak bisa dihubungi. Cek koneksi atau konfigurasi API.',
      );
    } finally {
      setIsRefreshingCaptcha(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadCaptcha async
    loadCaptcha();
  }, []);

  async function handleSubmit(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await accountApi.changePassword({
        oldPassword,
        newPassword,
        captchaToken: challenge?.captchaToken ?? '',
        captchaAnswer,
      });
      setMessage('Password berhasil diubah.');
      setOldPassword('');
      setNewPassword('');
      await loadCaptcha();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal mengubah password.');
      await loadCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Ubah Kata Sandi</h2>
      <p className="text-xs text-textMuted">
        Selesaikan captcha di bawah untuk memverifikasi bahwa ini benar-benar kamu.
      </p>
      <Input
        label="Password Saat Ini"
        type="password"
        placeholder="********"
        value={oldPassword}
        onChange={(event) => setOldPassword(event.target.value)}
      />
      <Input
        label="Password Baru"
        type="password"
        placeholder="Minimal 8 karakter"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <CaptchaField
        challenge={challenge}
        answer={captchaAnswer}
        onAnswerChange={setCaptchaAnswer}
        onRefresh={loadCaptcha}
        isRefreshing={isRefreshingCaptcha}
      />
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
      {message ? <p className="text-xs text-successText">{message}</p> : null}
      <div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !oldPassword || !newPassword || !captchaAnswer}
        >
          Simpan Password Baru
        </Button>
      </div>
    </Card>
  );
}

function TwoFactorActivationCard(): React.JSX.Element {
  const { user, refreshUser } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'setup' | 'done'>('idle');
  const [pendingToken, setPendingToken] = useState('');
  const [secret, setSecret] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginSetup(): Promise<void> {
    setPhase('loading');
    setError(null);
    try {
      const { pendingToken: token } = await authApi.startTwoFactorSetup();
      setPendingToken(token);
      const setup = await authApi.setupTwoFactor(token);
      setSecret(setup.secret);
      setOtp('');
      setPhase('setup');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal memulai setup 2FA.');
      setPhase('idle');
    }
  }

  async function refreshQr(): Promise<void> {
    try {
      const setup = await authApi.setupTwoFactor(pendingToken);
      setSecret(setup.secret);
      setOtp('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal memuat ulang kode QR.');
    }
  }

  async function handleActivate(): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    try {
      await authApi.confirmTwoFactorSetup({ pendingToken, secret, otpCode: otp });
      await refreshUser();
      setPhase('done');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Kode OTP salah, coba lagi.');
      setOtp('');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user?.twoFactorEnabled) {
    return (
      <Card className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-base font-semibold text-text">Two-Factor Authentication</h2>
        <span className="rounded-full bg-successBg px-3 py-1 text-xs font-semibold text-successText">
          Aktif
        </span>
        <p className="text-xs text-textMuted">
          Akun kamu sudah dilindungi kode OTP Google Authenticator setiap login.
        </p>
      </Card>
    );
  }

  if (phase === 'setup') {
    return (
      <Card>
        <TwoFactorSetupStep
          secret={secret}
          accountLabel={user?.username ?? ''}
          otp={otp}
          onOtpChange={setOtp}
          onCancel={() => setPhase('idle')}
          onActivate={handleActivate}
          isSubmitting={isSubmitting}
          onExpire={refreshQr}
        />
        {error ? <p className="mt-2 text-xs text-dangerText">{error}</p> : null}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <h2 className="text-base font-semibold text-text">Aktifkan Two Factor Authentication</h2>
      <p className="text-xs text-textMuted">
        Opsional — tambahkan lapisan keamanan kode OTP dari Google Authenticator setiap login.
        Kamu bisa aktifkan kapan saja lewat sini.
      </p>
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
      <Button onClick={beginSetup} loading={phase === 'loading'}>
        Aktifkan 2FA
      </Button>
    </Card>
  );
}

function SecurityTab(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-1">
          <h2 className="mb-1 text-base font-semibold text-text">Keamanan Akun</h2>
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
        <TwoFactorActivationCard />
        <SessionsCard />
      </div>
    </div>
  );
}

function AppearanceTab(): React.JSX.Element {
  const { theme, setTheme, font, setFont, language, setLanguage } = usePreferences();
  const { isCollapsed, toggleCollapsed } = useSidebarState();

  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Tampilan</h2>
      <ToggleRow
        title="Mode Gelap"
        description="Gunakan tema gelap (coklat tua) pada seluruh halaman"
        checked={theme === 'dark'}
        onChange={(next) => setTheme(next ? 'dark' : 'light')}
      />
      <ToggleRow
        title="Sidebar Ringkas"
        description="Ciutkan label menu, tampilkan ikon saja"
        checked={isCollapsed}
        onChange={() => toggleCollapsed()}
      />

      <div className="flex items-center justify-between border-b border-borderSoft py-4">
        <div>
          <p className="text-sm font-semibold text-text">Font Aplikasi</p>
          <p className="text-xs text-textMuted">Pilih jenis huruf yang dipakai di seluruh halaman</p>
        </div>
        <select
          value={font}
          onChange={(event) => setFont(event.target.value as typeof font)}
          className="rounded-md border border-borderSoft bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          {(Object.keys(FONT_LABEL) as (keyof typeof FONT_LABEL)[]).map((key) => (
            <option key={key} value={key}>
              {FONT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm font-semibold text-text">Bahasa</p>
          <p className="text-xs text-textMuted">Bahasa antarmuka aplikasi (Indonesia / English)</p>
        </div>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as typeof language)}
          className="rounded-md border border-borderSoft bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </div>
    </Card>
  );
}

function SystemTab(): React.JSX.Element {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('hours');
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();

  async function loadStatus(): Promise<void> {
    try {
      const res = await maintenanceApi.status();
      setStatus(res);
      setMessage(res.message ?? '');
    } catch {
      // biarkan status null — toggle tetap tampil OFF secara default
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadStatus async
    loadStatus();
  }, []);

  async function submitMaintenance(next: boolean): Promise<void> {
    setIsSaving(true);
    try {
      // estimatedUntil dihitung dari durasi yang diisi super_admin — bisa
      // dalam menit ATAU jam (lihat selector unit di bawah) — INI yang
      // jadi sumber hitung mundur real-time di layar blokir (lihat
      // RoleGuard.tsx MaintenanceBlockedScreen), bukan menebak dari teks
      // pesan bebas. Pesan default juga otomatis menyebut durasi yang SAMA
      // supaya teks & hitung mundur selalu konsisten satu sama lain.
      const durationMinutes = durationUnit === 'hours' ? durationValue * 60 : durationValue;
      const estimatedUntil = next
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null;
      const durationLabel =
        durationUnit === 'hours'
          ? `${durationValue} jam`
          : `${durationValue} menit`;
      const defaultMessage = `Mohon maaf mengganggu atas ketidaknyamanan kamu, harap bersabar kami ada pemeliharaan sekitar ${durationLabel}.`;
      const res = await maintenanceApi.set({
        isActive: next,
        message: message || defaultMessage,
        estimatedUntil,
      });
      setStatus(res);
      toast.success(next ? 'Mode pemeliharaan diaktifkan.' : 'Mode pemeliharaan dinonaktifkan.');
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal mengubah mode pemeliharaan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleMaintenance(next: boolean): Promise<void> {
    if (next) {
      const ok = await confirm({
        title: 'Aktifkan Mode Pemeliharaan?',
        message:
          'Semua user selain Super Admin TIDAK akan bisa membuka fitur apa pun sampai mode ini dimatikan lagi. Mereka akan diminta menghubungi Super Admin.',
        confirmLabel: 'Ya, Aktifkan',
        variant: 'danger',
      });
      if (!ok) return;
    }
    await submitMaintenance(next);
  }

  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Sistem</h2>
      <ToggleRow
        title="Sinkronisasi Otomatis"
        description="Sinkronkan data dengan backend gostock setiap 5 menit"
      />
      <ToggleRow
        title="Mode Pemeliharaan"
        description="Nonaktifkan sementara akses non-Super Admin ke seluruh fitur"
        checked={status?.isActive ?? false}
        onChange={handleToggleMaintenance}
      />
      {status?.isActive ? (
        <div className="flex flex-col gap-3 border-t border-borderSoft pt-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Input
              label="Pesan untuk user lain"
              placeholder="Sistem sedang dalam pemeliharaan..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div>
              <label htmlFor="maintenance-duration" className="mb-1 block text-sm text-text">
                Estimasi
              </label>
              <div className="flex gap-1.5">
                <input
                  id="maintenance-duration"
                  type="number"
                  min={1}
                  max={durationUnit === 'hours' ? 48 : 2880}
                  value={durationValue}
                  onChange={(event) => setDurationValue(Math.max(1, Number(event.target.value)))}
                  className="w-20 rounded-md border border-borderSoft bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                />
                <select
                  aria-label="Satuan estimasi"
                  value={durationUnit}
                  onChange={(event) => setDurationUnit(event.target.value as 'minutes' | 'hours')}
                  className="rounded-md border border-borderSoft bg-surface px-2 py-2.5 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="minutes">Menit</option>
                  <option value="hours">Jam</option>
                </select>
              </div>
            </div>
          </div>
          <p className="text-xs text-textMuted">
            User yang diblokir akan melihat hitung mundur real-time menuju perkiraan waktu selesai
            di atas, dan otomatis mendapat notifikasi begitu mode ini dimatikan.
          </p>
          <div>
            <Button
              variant="secondary"
              onClick={() => submitMaintenance(true)}
              disabled={isSaving}
            >
              Simpan Pesan &amp; Estimasi
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-borderSoft pt-4">
        <div>
          <p className="text-sm font-semibold text-text">Versi Aplikasi</p>
          <p className="text-xs text-textMuted">Lihat riwayat pembaruan & fitur terbaru</p>
        </div>
        <Link href="/changelog" className="text-xs font-semibold text-accentDark hover:underline">
          Lihat Changelog
        </Link>
      </div>
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
