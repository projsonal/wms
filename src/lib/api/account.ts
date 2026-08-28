import { apiClient, uploadFile } from '@/lib/api/client';

export const accountApi = {
  changePassword: (payload: {
    oldPassword: string;
    newPassword: string;
    humanCheckToken: string;
  }) => apiClient.patch<null>('/users/me/password', payload),

  updateMe: (payload: { username?: string; fullName?: string; email?: string; phoneNumber?: string }) =>
    apiClient.patch<unknown>('/users/me', payload),

  uploadAvatar: (file: File) => uploadFile<unknown>('/users/me/avatar', file, 'avatar'),

  removeAvatar: () => apiClient.delete<unknown>('/users/me/avatar'),
};
