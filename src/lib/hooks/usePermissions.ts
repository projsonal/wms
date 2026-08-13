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
  /** true selagi matrix izin masih dimuat — dipakai supaya tombol tidak
   * "berkedip" sempat hilang lalu muncul saat data belum sampai. */
  isLoading: boolean;
  /** Cek apakah user yang login (berdasarkan role_id di sesi JWT-nya)
   * punya izin `action` untuk `module` tertentu. super_admin SELALU true
   * (sama seperti aturan backend di RequirePermission), karena Super Admin
   * tidak diatur lewat matrix — lihat PermissionMatrixCard.tsx. */
  can: (module: string, action: keyof typeof MATRIX_ACTION_KEY) => boolean;
}

/**
 * Membaca matrix perizinan (GET /roles/:roleId/permissions) untuk ROLE user
 * yang sedang login — dipakai supaya UI (tombol Add/Print/dll di
 * TableRowActionBar) benar-benar mengikuti apa yang di-toggle Super Admin
 * di halaman Settings > Perizinan Hak Akses User, bukan cuma menebak dari
 * role (super_admin/admin = staff, selain itu tidak boleh apa-apa) seperti
 * sebelumnya.
 */
export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const { data, isLoading } = useSWR(
    user && !isSuperAdmin ? ['permission-matrix', user.roleId] : null,
    () => rolesApi.getPermissionMatrix(user!.roleId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
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

  return { isLoading: user && !isSuperAdmin ? isLoading : false, can };
}
