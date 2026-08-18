import { apiClient, uploadFile } from '@/lib/api/client';

/**
 * PATCH /users/me/password — ganti password milik akun sendiri, SATU
 * langkah (tidak lagi lewat OTP WhatsApp — lihat
 * internal/controller/users/user_controller.go ChangePassword()).
 * Diverifikasi lewat human-check token (lihat pkg/humancheck backend &
 * komponen HumanCheckField.tsx) — BUKAN lagi captcha gambar.
 */
export const accountApi = {
  changePassword: (payload: {
    oldPassword: string;
    newPassword: string;
    humanCheckToken: string;
  }) => apiClient.patch<null>('/users/me/password', payload),

  /** PATCH /users/me — ubah profil sendiri (nama, username, email, no. HP).
   * Role & status aktif TIDAK bisa diubah lewat endpoint ini (backend
   * mengabaikannya, lihat UpdateMeRequest di user_controller.go). Foto
   * profil TIDAK lewat sini — pakai uploadAvatar/removeAvatar di bawah
   * (endpoint terpisah, lihat catatan panjang di UpdateMeRequest kenapa).
   * Panggil `refreshUser()` dari AuthContext setelah ini supaya state
   * user global ikut ter-update (endpoint ini balas objek User, bukan
   * bentuk AuthUser). */
  updateMe: (payload: { username?: string; fullName?: string; email?: string; phoneNumber?: string }) =>
    apiClient.patch<unknown>('/users/me', payload),

  /** POST /users/me/avatar (multipart, field "avatar") — upload foto profil,
   * maks. 2MB, langsung mengganti avatarUrl user yang login. Panggil
   * `refreshUser()` setelah ini juga (lihat catatan updateMe di atas). */
  uploadAvatar: (file: File) => uploadFile<unknown>('/users/me/avatar', file, 'avatar'),

  /** DELETE /users/me/avatar — hapus foto profil, kembali ke avatar
   * inisial/default. Panggil `refreshUser()` setelah ini juga. */
  removeAvatar: () => apiClient.delete<unknown>('/users/me/avatar'),
};
