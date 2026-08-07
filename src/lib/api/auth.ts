import { apiClient, setAccessToken, setRefreshToken } from '@/lib/api/client';
import type {
  AuthFlowResponse,
  AuthUser,
  LoginPayload,
  OtpMethod,
  RegisterPayload,
  RequestOtpResponse,
  RequestPasswordResetPayload,
  RequestPasswordResetResponse,
  ResetPasswordPayload,
  SessionInfo,
  Setup2FAResponse,
  UserRole,
  VerifyPasswordResetOtpPayload,
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
  return res;
}

/**
 * Endpoint-endpoint autentikasi, 1:1 dengan
 * internal/controller/auth/auth_controller.go pada backend gostock.
 *
 * Alur login: login() -> (setupTwoFactor()+confirmTwoFactorSetup()) ATAU
 * (requestOtp()+verifyOtp()) -> token sesi didapat dari langkah konfirmasi/
 * verifikasi terakhir, BUKAN dari login() itu sendiri (login() hanya
 * memberi `pendingToken` sebagai jembatan sementara).
 */
export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient
      .post<AuthFlowResponse>('/auth/register', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

  login: (payload: LoginPayload) =>
    apiClient
      .post<AuthFlowResponse>('/auth/login', payload, { skipAuth: true })
      .then(persistSessionIfPresent),

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

  /** Minta kode OTP dikirim via WhatsApp (alternatif dari kode TOTP aplikasi Authenticator). */
  requestOtp: (pendingToken: string, method: Extract<OtpMethod, 'whatsapp'> = 'whatsapp') =>
    apiClient.post<RequestOtpResponse>(
      '/auth/otp/request',
      { pendingToken, method },
      { skipAuth: true },
    ),

  verifyOtp: (payload: {
    pendingToken: string;
    otpCode: string;
    method?: OtpMethod;
    otpToken?: string;
  }) =>
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

  revokeSession: (id: number) => apiClient.delete<null>(`/auth/sessions/${id}`),

  /**
   * Alur lupa password: requestPasswordReset() mengirim OTP lewat
   * WhatsApp/SMS ke nomor terdaftar -> verifyPasswordResetOtp() menukar
   * kode OTP dengan konfirmasi bahwa reset boleh dilanjut -> resetPassword()
   * menyimpan password baru. Nama endpoint & bentuk payload mengikuti pola
   * REST /auth/* yang sudah ada; sesuaikan path di sini kalau kontrak
   * backend gostock yang sebenarnya berbeda.
   */
  requestPasswordReset: (payload: RequestPasswordResetPayload) =>
    apiClient.post<RequestPasswordResetResponse>('/auth/password/forgot', payload, {
      skipAuth: true,
    }),

  verifyPasswordResetOtp: (payload: VerifyPasswordResetOtpPayload) =>
    apiClient.post<RequestPasswordResetResponse>('/auth/password/verify-otp', payload, {
      skipAuth: true,
    }),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<null>('/auth/password/reset', payload, { skipAuth: true }),
};
