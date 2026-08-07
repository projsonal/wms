import { apiClient } from '@/lib/api/client';

export interface RequestChangePasswordResponse {
  otpToken: string;
  expiresInSeconds: number;
}

/**
 * PATCH /users/me/password/* — ganti password milik akun sendiri.
 * Dua langkah (sesuai internal/controller/users/user_controller.go):
 *   1. requestOtp: kirim password lama, backend verifikasi lalu kirim
 *      kode OTP ke WhatsApp terdaftar.
 *   2. confirm: kirim otp_token (dari langkah 1) + kode OTP + password baru.
 */
export const accountApi = {
  requestChangePasswordOtp: (oldPassword: string) =>
    apiClient.patch<RequestChangePasswordResponse>('/users/me/password/request-otp', {
      oldPassword,
    }),

  confirmChangePassword: (payload: { otpToken: string; otpCode: string; newPassword: string }) =>
    apiClient.patch<null>('/users/me/password/confirm', payload),
};
