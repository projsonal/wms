'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isAssetNotifEnabled, isStockNotifEnabled } from '@/lib/notifications-context';
import { isAutoLogoutEnabled } from '@/component/system/InactivityLogout';
import { isLoginGuideEnabled, setLoginGuideEnabled } from '@/component/system/LoginGuide';
import { isAutoSyncEnabled, setAutoSyncEnabled } from '@/component/system/AutoSync';
import clsx from 'clsx';
import { ChevronDown, CheckCircle2, RefreshCw, DownloadCloud, AlertTriangle } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { Card } from '@/component/ui/Card';
import { Button } from '@/component/ui/Button';
import { Input } from '@/component/ui/FormControls';
import { TwoFactorSetupStep } from '@/component/auth/TwoFactorSetupStep';
import { HumanCheckField } from '@/component/auth/HumanCheckField';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePreferences } from '@/component/preferences/PreferencesContext';
import { useTranslations, type TranslationKey } from '@/lib/i18n/translations';
import { useSidebarState } from '@/component/layout/SidebarContext';
import { useAuthedImage } from '@/lib/hooks/useAuthedImage';
import { ROLE_LABEL } from '@/auth/roles';
import { authApi } from '@/lib/api/auth';
import { accountApi } from '@/lib/api/account';
import { maintenanceApi, appInfoApi, type MaintenanceStatus, type AppVersionInfo, type CheckUpdateInfo, type SelfUpdateStatus, type SelfUpdateState } from '@/lib/api/modules';
import { HttpError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import type { SessionInfo } from '@/types';

type SettingsTab = 'profil' | 'notifikasi' | 'keamanan' | 'tampilan' | 'sistem';

const TAB_IDS: SettingsTab[] = ['profil', 'notifikasi', 'keamanan', 'tampilan', 'sistem'];
const TAB_LABEL_KEY: Record<SettingsTab, TranslationKey> = {
  profil: 'settings.tabs.profil',
  notifikasi: 'settings.tabs.notifikasi',
  keamanan: 'settings.tabs.keamanan',
  tampilan: 'settings.tabs.tampilan',
  sistem: 'settings.tabs.sistem',
};

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: Readonly<{
  title: string;
  description: string;

  checked?: boolean;
  onChange?: (next: boolean) => void;
}>): React.JSX.Element {
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
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {

    setFullName(user?.fullName ?? '');

    setUsername(user?.username ?? '');

    setEmail(user?.email ?? '');

    setPhoneNumber(user?.phoneNumber ?? '');
  }, [user]);

  async function handleSave(): Promise<void> {
    if (username.trim().length < 4) {
      toast.error('Username minimal 4 karakter.');
      return;
    }
    setIsSaving(true);
    try {
      await accountApi.updateMe({ username: username.trim(), fullName, email, phoneNumber });
      await refreshUser();
      toast.success('Profil berhasil diperbarui.');
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal menyimpan perubahan profil.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 2MB.');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      await accountApi.uploadAvatar(file);
      await refreshUser();
      toast.success('Foto profil berhasil diperbarui.');
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal mengunggah foto profil.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar(): Promise<void> {
    setIsRemovingAvatar(true);
    try {
      await accountApi.removeAvatar();
      await refreshUser();
      toast.success('Foto profil berhasil dihapus, kembali ke avatar default.');
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal menghapus foto profil.');
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  const avatarUrl = useAuthedImage(user?.avatarUrl);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Profil</h2>
      <div className="flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutralBg">
          <img src={avatarUrl ?? '/assets/default-avatar.png'} alt="Foto profil" className="h-full w-full object-cover" />
        </span>
        <div className="flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={isUploadingAvatar}
            >
              Ubah Foto Profil
            </Button>
            {user?.avatarUrl ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleRemoveAvatar}
                loading={isRemovingAvatar}
              >
                Hapus Foto Profil
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-textMuted">JPG/PNG, maksimal 2MB.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Nama Lengkap" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <Input
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={4}
          maxLength={50}
        />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Nomor HP" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />

        <Input label="Role" defaultValue={user ? ROLE_LABEL[user.role] : ''} readOnly disabled />
      </div>
      <div>
        <Button onClick={handleSave} loading={isSaving}>Simpan Perubahan</Button>
      </div>
    </Card>
  );
}

function NotificationTab(): React.JSX.Element {
  const [assetNotifEnabled, setAssetNotifEnabled] = useState(true);
  const [stockNotifEnabled, setStockNotifEnabled] = useState(true);

  useEffect(() => {

    setAssetNotifEnabled(isAssetNotifEnabled());

    setStockNotifEnabled(isStockNotifEnabled());
  }, []);

  function handleToggleAssetNotif(next: boolean): void {
    setAssetNotifEnabled(next);
    setAssetNotifEnabled(next);
    toast.success(next ? 'Notifikasi aset diaktifkan.' : 'Notifikasi aset dimatikan.');
  }

  function handleToggleStockNotif(next: boolean): void {
    setStockNotifEnabled(next);
    setStockNotifEnabled(next);
    toast.success(next ? 'Peringatan stok minimum diaktifkan.' : 'Peringatan stok minimum dimatikan.');
  }

  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">Preferensi Notifikasi</h2>
      <p className="mb-2 text-xs text-textMuted">
        Preferensi di bawah ini tersimpan lokal di perangkat ini — menentukan jenis notifikasi apa
        yang ditampilkan di lonceng notifikasi pada perangkat ini.
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
        checked={stockNotifEnabled}
        onChange={handleToggleStockNotif}
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

    loadSessions();
  }, []);

  async function handleRevoke(id?: number): Promise<void> {
    if (!id) return;
    setRevokingId(id);
    try {
      const res = await authApi.revokeSession(id);
      if (res.revokedCurrent) {
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
  const [humanCheckToken, setHumanCheckToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    setError(null);
    if (!humanCheckToken) {
      setError('Tunggu proses verifikasi "kamu bukan robot" selesai dulu.');
      return;
    }
    setIsSubmitting(true);
    try {
      await accountApi.changePassword({
        oldPassword,
        newPassword,
        humanCheckToken,
      });
      setMessage('Password berhasil diubah.');
      setOldPassword('');
      setNewPassword('');
      setHumanCheckToken(null);
      setResetKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Gagal mengubah password.');
      setHumanCheckToken(null);
      setResetKey((k) => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Ubah Kata Sandi</h2>
      <p className="text-xs text-textMuted">
        Selesaikan verifikasi di bawah untuk memastikan bahwa ini benar-benar kamu.
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
      <HumanCheckField
        resetKey={resetKey}
        onVerified={setHumanCheckToken}
        onReset={() => setHumanCheckToken(null)}
      />
      {error ? <p className="text-xs text-dangerText">{error}</p> : null}
      {message ? <p className="text-xs text-successText">{message}</p> : null}
      <div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !oldPassword || !newPassword || !humanCheckToken}
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
        apabila kamu ingin akunnya aman bisa tambah keamanan double dengan menggunakan kode OTP dari Google Authenticator setiap login.
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
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const [loginGuideEnabled, setLoginGuideEnabledState] = useState(true);

  useEffect(() => {

    setAutoLogoutEnabled(isAutoLogoutEnabled());

    setLoginGuideEnabledState(isLoginGuideEnabled());
  }, []);

  function handleToggleAutoLogout(next: boolean): void {
    setAutoLogoutEnabled(next);
    setAutoLogoutEnabled(next);
    toast.success(next ? 'Sesi otomatis logout diaktifkan.' : 'Sesi otomatis logout dimatikan.');
  }

  function handleToggleLoginGuide(next: boolean): void {
    setLoginGuideEnabledState(next);
    setLoginGuideEnabled(next);
    toast.success(next ? 'Panduan setelah login diaktifkan.' : 'Panduan setelah login dimatikan.');
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-1">
          <h2 className="mb-1 text-base font-semibold text-text">Keamanan Akun</h2>
          <ToggleRow
            title="Panduan Setelah Login"
            description="Tampilkan ringkasan singkat cara mulai memakai aplikasi setiap berhasil login (preferensi lokal)"
            checked={loginGuideEnabled}
            onChange={handleToggleLoginGuide}
          />
          <ToggleRow
            title="Sesi Otomatis Logout"
            description="Logout otomatis setelah 30 menit tidak aktif (preferensi lokal)"
            checked={autoLogoutEnabled}
            onChange={handleToggleAutoLogout}
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
  const { theme, setTheme, language, setLanguage } = usePreferences();
  const { isCollapsed, toggleCollapsed } = useSidebarState();
  const t = useTranslations();

  return (
    <Card className="flex flex-col">
      <h2 className="mb-2 text-base font-semibold text-text">{t('settings.appearance.title')}</h2>
      <ToggleRow
        title={t('settings.appearance.darkMode.title')}
        description={t('settings.appearance.darkMode.description')}
        checked={theme === 'dark'}
        onChange={(next) => setTheme(next ? 'dark' : 'light')}
      />
      <ToggleRow
        title={t('settings.appearance.compactSidebar.title')}
        description={t('settings.appearance.compactSidebar.description')}
        checked={isCollapsed}
        onChange={() => toggleCollapsed()}
      />

      <div className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm font-semibold text-text">{t('settings.appearance.language.title')}</p>
          <p className="text-xs text-textMuted">{t('settings.appearance.language.description')}</p>
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

interface CekUpdateSectionProps {
  isSuperAdmin: boolean;
  checkUpdateInfo: CheckUpdateInfo;
  isCheckingUpdate: boolean;
  checkUpdateError: string | null;
  isTriggeringUpdate: boolean;
  isRunning: boolean;
  onCheckUpdate: () => void;
  onTriggerUpdate: () => void;
}

function UpdateActionRow({
  isSuperAdmin,
  latestVersion,
  selfUpdateEnabled,
  isTriggeringUpdate,
  isRunning,
  onTriggerUpdate,
}: Readonly<{
  isSuperAdmin: boolean;
  latestVersion?: string;
  selfUpdateEnabled: boolean;
  isTriggeringUpdate: boolean;
  isRunning: boolean;
  onTriggerUpdate: () => void;
}>): React.JSX.Element {
  if (!isSuperAdmin) {
    return <p className="text-[11px] text-textMuted">Hubungi Super Admin untuk memperbarui aplikasi.</p>;
  }
  if (!selfUpdateEnabled) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-warningText">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Fitur &quot;Update Sekarang&quot; belum diaktifkan di server coba lakukan pengecekan.
      </p>
    );
  }
  return (
    <div>
      <Button variant="primary" onClick={onTriggerUpdate} disabled={isTriggeringUpdate || isRunning} className="mt-1">
        {isTriggeringUpdate ? 'Memulai...' : `Update Sekarang ke ${latestVersion}`}
      </Button>
    </div>
  );
}

function UpdateStatusCard({ updateStatus }: Readonly<{ updateStatus: SelfUpdateStatus }>): React.JSX.Element {
  const stateLabel: Record<Exclude<SelfUpdateState, 'idle'>, string> = {
    running: `Sedang memperbarui ke ${updateStatus.toVersion}...`,
    success: `Berhasil diperbarui ke ${updateStatus.toVersion}`,
    failed: `Update ke ${updateStatus.toVersion} gagal`,
  };
  const stateIcon: Record<Exclude<SelfUpdateState, 'idle'>, React.JSX.Element> = {
    running: <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />,
    success: <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />,
    failed: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />,
  };
  const stateBg: Record<Exclude<SelfUpdateState, 'idle'>, string> = {
    running: 'bg-accentSoft/40 text-accentDark',
    success: 'bg-successBg text-successText',
    failed: 'bg-dangerBg text-dangerText',
  };
  const state = updateStatus.state as Exclude<SelfUpdateState, 'idle'>;

  return (
    <div className={clsx('flex items-start gap-2 rounded-md border border-borderSoft p-2.5 text-[11px]', stateBg[state])}>
      {stateIcon[state]}
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">{stateLabel[state]}</p>
        <p className="text-textMuted">{updateStatus.message}</p>
      </div>
    </div>
  );
}

function CekUpdateSection({
  isSuperAdmin,
  checkUpdateInfo,
  isCheckingUpdate,
  checkUpdateError,
  isTriggeringUpdate,
  isRunning,
  onCheckUpdate,
  onTriggerUpdate,
}: CekUpdateSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-borderSoft p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-accentDark">
          <DownloadCloud className="h-3.5 w-3.5 shrink-0" />
          Versi baru tersedia: {checkUpdateInfo.latestVersion}
        </p>
        <button
          type="button"
          onClick={onCheckUpdate}
          disabled={isCheckingUpdate || isRunning}
          className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accentDark hover:underline disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-3 w-3', isCheckingUpdate && 'animate-spin')} />
          {isCheckingUpdate ? 'Mengecek ulang...' : 'Cek ulang'}
        </button>
      </div>

      {checkUpdateError ? (
        <p className="flex items-center gap-1.5 text-dangerText">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {checkUpdateError}
        </p>
      ) : null}

      {checkUpdateInfo.releaseNotes ? (
        <p className="whitespace-pre-line rounded-md bg-neutralBg p-2 text-[11px] text-textMuted">
          {checkUpdateInfo.releaseNotes}
        </p>
      ) : null}
      {checkUpdateInfo.releaseUrl ? (
        <a
          href={checkUpdateInfo.releaseUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-[11px] font-semibold text-accentDark hover:underline"
        >
          Lihat catatan rilis lengkap di GitHub →
        </a>
      ) : null}
      <UpdateActionRow
        isSuperAdmin={isSuperAdmin}
        latestVersion={checkUpdateInfo.latestVersion}
        selfUpdateEnabled={checkUpdateInfo.selfUpdateEnabled}
        isTriggeringUpdate={isTriggeringUpdate}
        isRunning={isRunning}
        onTriggerUpdate={onTriggerUpdate}
      />
    </div>
  );
}

interface MaintenanceSectionProps {
  status: MaintenanceStatus | null;
  message: string;
  setMessage: (value: string) => void;
  durationValue: number;
  setDurationValue: (value: number) => void;
  durationUnit: 'minutes' | 'hours';
  setDurationUnit: (value: 'minutes' | 'hours') => void;
  isSaving: boolean;
  onToggleMaintenance: (next: boolean) => void;
  onSubmitMaintenance: (next: boolean) => void;
}

function MaintenanceSection({
  status,
  message,
  setMessage,
  durationValue,
  setDurationValue,
  durationUnit,
  setDurationUnit,
  isSaving,
  onToggleMaintenance,
  onSubmitMaintenance,
}: Readonly<MaintenanceSectionProps>): React.JSX.Element {
  return (
    <>
      <ToggleRow
        title="Mode Pemeliharaan"
        description="Nonaktifkan sementara akses non-Super Admin ke seluruh fitur"
        checked={status?.isActive ?? false}
        onChange={onToggleMaintenance}
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
            <Button variant="secondary" onClick={() => onSubmitMaintenance(true)} disabled={isSaving}>
              Simpan Pesan &amp; Estimasi
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SystemTab(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('hours');
  const [isSaving, setIsSaving] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(false);

  useEffect(() => {

    setAutoSyncEnabledState(isAutoSyncEnabled());
  }, []);

  function handleToggleAutoSync(next: boolean): void {
    setAutoSyncEnabledState(next);
    setAutoSyncEnabled(next);
    toast.success(
      next
        ? 'Sinkronisasi otomatis diaktifkan — semua modul akan disegarkan tiap 1 menit.'
        : 'Sinkronisasi otomatis dimatikan.',
    );
  }

  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);

  const [checkUpdateInfo, setCheckUpdateInfo] = useState<CheckUpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkUpdateError, setCheckUpdateError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<SelfUpdateStatus | null>(null);
  const [isTriggeringUpdate, setIsTriggeringUpdate] = useState(false);

  const [isUpdatePanelOpen, setIsUpdatePanelOpen] = useState(false);
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

  async function fetchUpdateStatus(): Promise<void> {
    try {
      setUpdateStatus(await appInfoApi.updateStatus());
    } catch {
      // biarkan null — kartu progres cukup tidak ditampilkan
    }
  }

  async function handleCheckUpdate(): Promise<void> {
    setIsCheckingUpdate(true);
    setCheckUpdateError(null);
    try {
      setCheckUpdateInfo(await appInfoApi.checkUpdate());
    } catch (err) {
      setCheckUpdateError(err instanceof HttpError ? err.message : 'Gagal mengecek update.');
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  useEffect(() => {

    loadStatus();

    appInfoApi.version().then(setVersionInfo).catch(() => {});
    fetchUpdateStatus();
    handleCheckUpdate();
  }, []);

  useEffect(() => {
    if (updateStatus?.state !== 'running') return;
    const interval = setInterval(() => {
      appInfoApi
        .updateStatus()
        .then(setUpdateStatus)
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [updateStatus?.state]);

  async function handleTriggerUpdate(): Promise<void> {
    if (!checkUpdateInfo?.latestVersion) return;
    const ok = await confirm({
      title: `Update ke ${checkUpdateInfo.latestVersion}?`,
      message:
        'Server akan masuk Mode Pemeliharaan sementara, mengunduh & memasang versi baru, lalu restart otomatis. Kalau health check gagal, sistem otomatis kembali ke versi sekarang (rollback). Proses ini butuh waktu beberapa menit.',
      confirmLabel: 'Ya, Update Sekarang',
      variant: 'danger',
    });
    if (!ok) return;

    setIsTriggeringUpdate(true);
    try {
      const status = await appInfoApi.triggerUpdate();
      setUpdateStatus(status);
      toast.success('Update dimulai di latar belakang, pantau progresnya di bawah.');
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal memulai update.');
    } finally {
      setIsTriggeringUpdate(false);
    }
  }

  async function submitMaintenance(next: boolean): Promise<void> {
    setIsSaving(true);
    try {

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
        description="Segarkan ulang data di semua modul yang sedang terbuka setiap 1 menit"
        checked={autoSyncEnabled}
        onChange={handleToggleAutoSync}
      />
      {isSuperAdmin ? (
        <MaintenanceSection
          status={status}
          message={message}
          setMessage={setMessage}
          durationValue={durationValue}
          setDurationValue={setDurationValue}
          durationUnit={durationUnit}
          setDurationUnit={setDurationUnit}
          isSaving={isSaving}
          onToggleMaintenance={handleToggleMaintenance}
          onSubmitMaintenance={submitMaintenance}
        />
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-borderSoft pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-text">Versi Aplikasi</p>
            <p className="text-xs text-textMuted">
              {versionInfo ? (
                <>
                  {versionInfo.appName} <span className="font-semibold text-text">{versionInfo.version}</span>
                </>
              ) : (
                'Memuat versi...'
              )}
            </p>
          </div>

          {checkUpdateInfo?.updateAvailable ? (
            <button
              type="button"
              onClick={() => setIsUpdatePanelOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-semibold text-accentDark hover:bg-accentSoft/80"
            >
              <DownloadCloud className="h-3.5 w-3.5" />
              Update Tersedia: {checkUpdateInfo.latestVersion}
              <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', isUpdatePanelOpen && 'rotate-180')} />
            </button>
          ) : null}
        </div>
        {versionInfo?.description ? (
          <div className="rounded-md border border-borderSoft bg-neutralBg p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Tentang Aplikasi</p>
            <p className="mt-1 text-xs text-text">{versionInfo.description}</p>
            {versionInfo.developer ? (
              <p className="mt-1.5 text-[11px] text-textMuted">Dikembangkan oleh {versionInfo.developer}</p>
            ) : null}
          </div>
        ) : null}

        {isUpdatePanelOpen && checkUpdateInfo?.updateAvailable ? (
          <CekUpdateSection
            isSuperAdmin={isSuperAdmin}
            checkUpdateInfo={checkUpdateInfo}
            isCheckingUpdate={isCheckingUpdate}
            checkUpdateError={checkUpdateError}
            isTriggeringUpdate={isTriggeringUpdate}
            isRunning={updateStatus?.state === 'running'}
            onCheckUpdate={handleCheckUpdate}
            onTriggerUpdate={handleTriggerUpdate}
          />
        ) : null}

        {updateStatus && updateStatus.state !== 'idle' ? <UpdateStatusCard updateStatus={updateStatus} /> : null}
      </div>
    </Card>
  );
}

export function SettingsContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');
  const t = useTranslations();

  return (
    <PageShell title={t('settings.title')} breadcrumb={t('settings.title')}>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-lg font-bold text-text">{t('settings.title')}</h2>
          <div className="flex flex-wrap gap-2">
            {TAB_IDS.map((tabId) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  activeTab === tabId ? 'bg-accent text-white' : 'text-textMuted hover:bg-surfaceAlt',
                )}
              >
                {t(TAB_LABEL_KEY[tabId])}
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
