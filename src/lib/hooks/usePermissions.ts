'use client';

import useSWR from 'swr';
import { useAuth } from '@/auth/AuthContext';
import { rolesApi, type PermissionMatrixItem } from '@/lib/api/modules';

type PermissionAction = keyof Omit<PermissionMatrixItem, 'module'>;

const MATRIX_ACTION_KEY: Record<'tambah' | 'edit' | 'print' | 'view' | 'approvalReject' | 'assignDelegasi', PermissionAction> = {
  tambah: 'tambah',
  edit: 'edit',
  print: 'print',
  view: 'view',
  approvalReject: 'approvalReject',
  assignDelegasi: 'assignDelegasi',
};

interface UsePermissionsResult {

  isLoading: boolean;

  // true kalau fetch matrix izin gagal terus setelah semua retry habis —
  // dipakai RoleGuard supaya TIDAK menganggap ini "ditolak" (403), karena
  // itu berarti server/koneksi bermasalah, bukan berarti user memang tidak
  // punya izin.
  hasError: boolean;

  can: (module: string, action: keyof typeof MATRIX_ACTION_KEY) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Sebelumnya shouldRetryOnError: false — kalau fetch matrix izin gagal
  // SEKALI SAJA (blip jaringan, cold-start server, dsb), can() permanen
  // menganggap user tidak punya izin ke MANA PUN sampai reload penuh —
  // RoleGuard lalu redirect ke /status/403?reason=modul di setiap halaman
  // yang dikunjungi, dan tombol "kembali" di halaman itu balik lagi ke
  // halaman yang sama-sama diblokir → kelihatan macet di 403 terus. Retry
  // otomatis di sini menutup celah itu untuk kasus kegagalan sementara.
  const { data, isLoading, error } = useSWR(
    user && !isSuperAdmin ? ['permission-matrix', user.roleId] : null,
    () => rolesApi.getPermissionMatrix(user!.roleId),
    { revalidateOnFocus: false, errorRetryCount: 3, errorRetryInterval: 1500 },
  );

  const byModule: Record<string, PermissionMatrixItem> = {};
  (data?.items ?? []).forEach((item) => {
    byModule[item.module] = item;
  });

  function can(module: string, action: keyof typeof MATRIX_ACTION_KEY): boolean {
    if (isSuperAdmin) {
      return true;
    }
    const item = byModule[module];
    if (!item) {
      return false;
    }
    return Boolean(item[MATRIX_ACTION_KEY[action]]);
  }

  return {
    isLoading: user && !isSuperAdmin ? isLoading : false,
    hasError: user && !isSuperAdmin ? Boolean(error) : false,
    can,
  };
}
