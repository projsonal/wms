import { apiClient, setAccessToken, setRefreshToken } from '@/lib/api/client';
import type {
  AuthFlowResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  SessionInfo,
  Setup2FAResponse,
  UserRole,
} from '@/types';

interface MeResponseRaw {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  roleId: number;
  roleName: UserRole;
  is2faEnabled: boolean;
  avatarUrl?: string;
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
    avatarUrl: raw.avatarUrl || undefined,
  };
}

function persistSessionIfPresent(res: AuthFlowResponse): AuthFlowResponse {
  if (res.accessToken) {
    setAccessToken(res.accessToken);
  }
  if (res.refreshToken) {
    setRefreshToken(res.refreshToken);
  }
  return res;
}

export const authApi = {

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
    apiClient.delete<{ revokedCurrent?: boolean }>(`/auth/sessions/${id}`),

  resetPassword: (payload: {
    identifier: string;
    newPassword: string;
    newPasswordConfirmation: string;
    humanCheckToken: string;
  }) => apiClient.post<null>('/auth/password/reset', payload, { skipAuth: true }),
};
