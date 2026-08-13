import { apiClient } from '@/lib/api/client';

/**
 * PATCH /users/me/password — ganti password milik akun sendiri, SATU
 * langkah (tidak lagi lewat OTP WhatsApp — lihat
 * internal/controller/users/user_controller.go ChangePassword()).
 * Diverifikasi captcha gambar self-hosted (sama seperti /security/challenge)
 * supaya tetap terlindung dari automated abuse.
 */
export const accountApi = {
  changePassword: (payload: {
    oldPassword: string;
    newPassword: string;
    captchaToken: string;
    captchaAnswer: string;
  }) => apiClient.patch<null>('/users/me/password', payload),
};
