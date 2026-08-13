import { apiClient, setAccessToken, setRefreshToken } from '@/lib/api/client';
import { setDemoUser } from '@/auth/demo';
import type {
  AuthFlowResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  SessionInfo,
  Setup2FAResponse,
  UserRole,
} from '@/types';

/**
 * Bentuk data GET /auth/me setelah key JSON-nya dikonversi camelCase oleh
 * `apiClient` (lihat lib/utils/casing.ts). Field `is_2fa_enabled` dari Go
 * mengandung angka di tengah kata, jadi hasil auto-camelCase-nya adalah
 * `is2faEnabled` (bukan `is2FaEnabled`) — didokumentasikan eksplisit di
 * sini alih-alih dihafal di banyak tempat.
 */
interface MeResponseRaw {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  roleId: number;
  roleName: UserRole;
  is2faEnabled: boolean;
}

function toAuthUser(raw: MeResponseRaw): AuthUser {
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    fullName: raw.fullName,
    phoneNumber: raw.phoneNumber,
    roleId: raw.roleId,
    role: raw.roleName,
    twoFactorEnabled: raw.is2faEnabled,
  };
}

/** Menyimpan access & refresh token dari respons yang sudah membawa sesi penuh. */
function persistSessionIfPresent(res: AuthFlowResponse): AuthFlowResponse {
  if (res.accessToken) {
    setAccessToken(res.accessToken);
  }
  if (res.refreshToken) {
    setRefreshToken(res.refreshToken);
  }
  if (res.accessToken || res.refreshToken) {
    // Login/registrasi ASLI berhasil -> pastikan tidak ada sisa user demo
    // ("Coba tanpa akun") yang nyangkut di localStorage. Kalau dibiarkan,
    // AuthContext.refreshUser() akan lebih memprioritaskan user demo
    // (lihat urutan ceknya) padahal token asli sudah aktif, menyebabkan
    // UI menampilkan role yang TIDAK SAMA dengan role sesungguhnya di
    // token yang benar-benar dikirim ke backend -> semua request nyata
    // ditolak "role anda tidak diizinkan" walau tampilan sempat terlihat benar.
    setDemoUser(null);
  }
  return res;
}

/**
 * Endpoint-endpoint autentikasi, 1:1 dengan
 * internal/controller/auth/auth_controller.go pada backend gostock.
 *
 * Alur login (aplikasi internal, 2FA OPSIONAL): login() -> kalau user
 * belum aktifkan 2FA, sesi (access/refresh token) sudah langsung ada di
 * respons login() itu sendiri (tidak ada langkah tambahan). Kalau user
 * SUDAH aktifkan 2FA sendiri lewat Settings, login() cuma memberi
 * `pendingToken` sementara, lalu requestOtp()+verifyOtp() yang memberi
 * sesi sesungguhnya. Setup 2FA (setupTwoFactor()+confirmTwoFactorSetup())
 * sekarang HANYA dipicu dari Settings -> Keamanan (lewat startTwoFactorSetup()),
 * bukan lagi bagian wajib dari alur login/register.
 */
export const authApi = {
  /** Cek ketersediaan username secara live saat mengetik di form daftar —
   * dipanggil dengan debounce dari RegisterStep, BUKAN dari submit form. */
  checkUsernameAvailability: (username: string) =>
    apiClient.get<{ available: boolean }>(
      `/auth/username-available?username=${encodeURIComponent(username)}`,
    ),

  register: (payload: RegisterPayload) =>
    apiClient
      .post<AuthFlowResponse>('/auth/register', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

  login: (payload: LoginPayload) =>
    apiClient
      .post<AuthFlowResponse>('/auth/login', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

  /** POST /auth/2fa/start (butuh login) — dipanggil dari Settings ->
   * Keamanan saat user MEMILIH SENDIRI mengaktifkan 2FA (opsional, bukan
   * lagi wajib saat register/login). Memberi pendingToken baru yang lalu
   * dipakai ulang ke setupTwoFactor()/confirmTwoFactorSetup() di bawah —
   * endpoint itu sendiri tidak berubah, cuma sumber pendingToken-nya beda. */
  startTwoFactorSetup: () => apiClient.post<{ pendingToken: string }>('/auth/2fa/start'),

  setupTwoFactor: (pendingToken: string) =>
    apiClient.post<Setup2FAResponse>(
      '/auth/2fa/setup',
      { pendingToken },
      { skipAuth: true },
    ),

  confirmTwoFactorSetup: (payload: { pendingToken: string; secret: string; otpCode: string }) =>
    apiClient
      .post<AuthFlowResponse>('/auth/2fa/confirm', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

  verifyOtp: (payload: { pendingToken: string; otpCode: string }) =>
    apiClient
      .post<AuthFlowResponse>('/auth/verify-otp', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

  refresh: (refreshToken: string) =>
    apiClient
      .post<AuthFlowResponse>('/auth/refresh', { refreshToken }, { skipAuth: true })
      .then(persistSessionIfPresent),

  me: () => apiClient.get<MeResponseRaw>('/auth/me').then(toAuthUser),

  logout: () => apiClient.post<null>('/auth/logout'),

  listSessions: () => apiClient.get<{ sessions: SessionInfo[] }>('/auth/sessions'),

  revokeSession: (id: number) =>
    apiClient.delete<{ revoked_current?: boolean }>(`/auth/sessions/${id}`),

  /**
   * Lupa password — SATU langkah (tidak lagi lewat OTP WhatsApp/SMS):
   * identifier + password baru + captcha. Lihat catatan keamanan lengkap
   * di internal/controller/auth/struct.go ResetPasswordRequest (backend)
   * soal tradeoff menghapus verifikasi kepemilikan akun ini.
   */
  resetPassword: (payload: {
    identifier: string;
    newPassword: string;
    newPasswordConfirmation: string;
    captchaToken: string;
    captchaAnswer: string;
  }) => apiClient.post<null>('/auth/password/reset', payload, { skipAuth: true }),
};
