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

  can: (module: string, action: keyof typeof MATRIX_ACTION_KEY) => boolean;
}

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
