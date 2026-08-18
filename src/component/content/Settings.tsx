'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isAssetNotifEnabled, setAssetNotifEnabled, isStockNotifEnabled, setStockNotifEnabled } from '@/lib/notifications-context';
import { isAutoLogoutEnabled, setAutoLogoutEnabled } from '@/component/system/InactivityLogout';
import clsx from 'clsx';
import { ChevronDown, CheckCircle2, Wrench } from 'lucide-react';
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
import { maintenanceApi, appInfoApi, type MaintenanceStatus, type AppVersionInfo, type ChangelogEntry } from '@/lib/api/modules';
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronkan form saat data user selesai dimuat
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
    event.target.value = ''; // supaya bisa pilih file yang sama lagi kalau mau
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
          {/* eslint-disable-next-line @next/next/no-img-element -- avatarUrl dari domain backend terpisah; default-avatar.png aset statis lokal, keduanya butuh <img> polos */}
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
            {/* Cuma tampil kalau memang sedang pakai foto (avatarUrl ada) —
                tidak ada gunanya menawarkan "hapus" kalau sudah avatar
                inisial default, lihat catatan removeAvatar di account.ts. */}
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
        {/* Role SENGAJA readOnly — tidak bisa diubah lewat form profil sendiri
            (backend juga menolaknya, lihat UpdateMeRequest di user_controller.go).
            Perubahan role hanya lewat Manajemen User oleh Super Admin/Admin. */}
        <Input label="Role" defaultValue={user ? ROLE_LABEL[user.role] : ''} readOnly disabled />
      </div>
      <div>
        <Button onClick={handleSave} loading={isSaving}>Simpan Perubahan</Button>
      </div>
    </Card>
  );
}

function NotificationTab(): React.JSX.Element {
  const [assetNotifEnabled, setAssetNotifEnabledState] = useState(true);
  const [stockNotifEnabled, setStockNotifEnabledState] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi tersimpan sekali saat mount
    setAssetNotifEnabledState(isAssetNotifEnabled());
     
    setStockNotifEnabledState(isStockNotifEnabled());
  }, []);

  function handleToggleAssetNotif(next: boolean): void {
    setAssetNotifEnabledState(next);
    setAssetNotifEnabled(next);
    toast.success(next ? 'Notifikasi aset diaktifkan.' : 'Notifikasi aset dimatikan.');
  }

  function handleToggleStockNotif(next: boolean): void {
    setStockNotifEnabledState(next);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadSessions async, lihat AuthContext untuk pola serupa
    loadSessions();
  }, []);

  async function handleRevoke(id?: number): Promise<void> {
    if (!id) return;
    setRevokingId(id);
    try {
      const res = await authApi.revokeSession(id);
      if (res.revokedCurrent) {
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
  const [autoLogoutEnabled, setAutoLogoutEnabledState] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca preferensi tersimpan sekali saat mount
    setAutoLogoutEnabledState(isAutoLogoutEnabled());
  }, []);

  function handleToggleAutoLogout(next: boolean): void {
    setAutoLogoutEnabledState(next);
    setAutoLogoutEnabled(next);
    toast.success(next ? 'Sesi otomatis logout diaktifkan.' : 'Sesi otomatis logout dimatikan.');
  }

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

function SystemTab(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('hours');
  const [isSaving, setIsSaving] = useState(false);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  // Changelog inline, TERTUTUP secara default — beda dari sebelumnya yang
  // langsung navigasi ke halaman /changelog terpisah tiap klik "Lihat
  // Changelog". Data baru di-fetch saat pertama kali dibuka (lazy), bukan
  // ikut dimuat bareng versionInfo di atas walau keduanya sama-sama dari
  // endpoint publik yang sama.
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [changelog, setChangelog] = useState<ChangelogEntry[] | null>(null);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const confirm = useConfirm();

  async function handleToggleChangelog(): Promise<void> {
    const next = !isChangelogOpen;
    setIsChangelogOpen(next);
    if (next && changelog === null) {
      setIsLoadingChangelog(true);
      try {
        setChangelog(await appInfoApi.changelog());
      } catch {
        setChangelog([]); // gagal -> tampilkan kosong daripada macet di "Memuat..." selamanya
      } finally {
        setIsLoadingChangelog(false);
      }
    }
  }

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
     
    appInfoApi.version().then(setVersionInfo).catch(() => {});
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
      {isSuperAdmin ? (
        <>
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
        </>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-borderSoft pt-4">
        <div className="flex items-center justify-between">
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
          <button
            type="button"
            onClick={handleToggleChangelog}
            className="flex items-center gap-1 text-xs font-semibold text-accentDark hover:underline"
          >
            {isChangelogOpen ? 'Tutup Changelog' : 'Lihat Changelog'}
            <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', isChangelogOpen && 'rotate-180')} />
          </button>
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

        {/* Riwayat pembaruan, TERTUTUP secara default (lihat isChangelogOpen).
            Halaman /changelog terpisah tetap ada & masih bisa diakses
            langsung (mis. dari luar aplikasi), ini cuma tambahan supaya
            tidak perlu pindah halaman dari Settings. */}
        {isChangelogOpen ? (
          <div className="flex flex-col gap-3 rounded-md border border-borderSoft p-3">
            {(() => {
              if (isLoadingChangelog) {
                return <p className="text-xs text-textMuted">Memuat riwayat pembaruan...</p>;
              }
              if (!changelog || changelog.length === 0) {
                return <p className="text-xs text-textMuted">Riwayat pembaruan belum tersedia.</p>;
              }
              return changelog.map((entry, index) => (
                <div key={entry.version} className="border-b border-dashed border-borderSoft pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-text">{entry.version}</p>
                    {index === 0 ? (
                      <span className="rounded-full bg-accentSoft px-2 py-0.5 text-[10px] font-semibold uppercase text-accentDark">
                        Terbaru
                      </span>
                    ) : null}
                    <span className="text-[11px] text-textMuted">{entry.date}</span>
                  </div>
                  {entry.changes.new && entry.changes.new.length > 0 ? (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-successText">
                        <CheckCircle2 className="h-3 w-3" /> Baru
                      </p>
                      <ul className="pl-4 text-xs text-text">
                        {entry.changes.new.map((item) => (
                          <li key={item} className="list-disc">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {entry.changes.fix && entry.changes.fix.length > 0 ? (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warningText">
                        <Wrench className="h-3 w-3" /> Perbaikan
                      </p>
                      <ul className="pl-4 text-xs text-text">
                        {entry.changes.fix.map((item) => (
                          <li key={item} className="list-disc">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ));
            })()}
          </div>
        ) : null}
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
