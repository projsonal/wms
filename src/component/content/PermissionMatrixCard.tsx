'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Card } from '@/component/ui/Card';
import { Select } from '@/component/ui/FormControls';
import { Button } from '@/component/ui/Button';
import { rolesApi, usersApi, type PermissionMatrixItem } from '@/lib/api/modules';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { HttpError } from '@/lib/api/client';
import { PERMISSION_MODULES, PERMISSION_TABS, type PermissionTabKey } from '@/lib/data/permission-modules';

type ActionKey = keyof Omit<PermissionMatrixItem, 'module'>;

const ACTION_COLUMNS: { key: ActionKey; label: string }[] = [
  { key: 'view', label: 'Lihat' },
  { key: 'approvalReject', label: 'Approval/Reject' },
  { key: 'tambah', label: 'Tambah' },
  { key: 'print', label: 'Print' },
  { key: 'edit', label: 'Edit' },
  { key: 'assignDelegasi', label: 'Assign/Delegasi' },
];

function emptyItem(module: string): PermissionMatrixItem {
  return {
    module,
    view: false,
    tambah: false,
    edit: false,
    approvalReject: false,
    print: false,
    assignDelegasi: false,
  };
}

function PermissionPill({
  checked,
  onChange,
  disabled,
}: Readonly<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}>): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative flex h-6 w-14 items-center rounded-full px-1.5 text-[10px] font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'justify-start bg-accent text-white' : 'justify-end bg-neutralBg text-textMuted',
      )}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
        {checked ? 'ON' : 'OFF'}
      </motion.span>
    </button>
  );
}

export function PermissionMatrixCard(): React.JSX.Element {
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [tab, setTab] = useState<PermissionTabKey>('umum');
  const [items, setItems] = useState<Record<string, PermissionMatrixItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [lookupMode, setLookupMode] = useState<'role' | 'username'>('role');
  const [allUsers, setAllUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [selectedUsername, setSelectedUsername] = useState('');

  useEffect(() => {
    usersApi
      .list({ pageSize: 200 })
      .then((res) => setAllUsers(res.data.map((u) => ({ id: u.id, username: u.username, role: u.role }))))
      .catch(() => setAllUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat mount
  }, []);

  useEffect(() => {
    rolesApi
      .list()
      .then((res) => {
        setRoles(res);
        const firstNonSuperAdmin = res.find((r) => r.name !== 'super_admin') ?? res[0];
        if (firstNonSuperAdmin) {
          setRoleId(firstNonSuperAdmin.id);
        }
      })
      .catch(() => setRoles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat mount
  }, []);

  useEffect(() => {
    if (lookupMode !== 'username' || !selectedUsername || roles.length === 0) {
      return;
    }
    const targetUser = allUsers.find((u) => u.username === selectedUsername);
    if (!targetUser) return;
    const matchedRole = roles.find((r) => r.name === targetUser.role);
    if (matchedRole) {
      setRoleId(matchedRole.id);
    }
  }, [lookupMode, selectedUsername, allUsers, roles]);

  useEffect(() => {
    if (roleId === null) {
      return;
    }
    let cancelled = false;

    setIsLoading(true);
    rolesApi
      .getPermissionMatrix(roleId)
      .then((res) => {
        if (cancelled) return;
        const byModule: Record<string, PermissionMatrixItem> = {};
        (res.items ?? []).forEach((item) => {
          byModule[item.module] = item;
        });
        setItems(byModule);
        setIsDirty(false);
      })
      .catch(() => {
        if (!cancelled) setItems({});
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roleId]);

  async function toggle(moduleKey: string, moduleLabel: string, action: ActionKey): Promise<void> {
    const current = items[moduleKey] ?? emptyItem(moduleKey);
    const willEnable = !current[action];

    if (willEnable) {
      const roleName = roles.find((r) => r.id === roleId)?.name ?? 'role ini';
      const actionLabel = ACTION_COLUMNS.find((c) => c.key === action)?.label ?? action;
      const ok = await confirm({
        title: 'Apakah kamu yakin memberikan Izin terhadap Akses Ini?',
        message: `Apakah kamu yakin mengizinkan users dengan role "${roleName}" fitur "${actionLabel}" pada modul "${moduleLabel}"?`,
        confirmLabel: 'Ya, Izinkan',
        variant: 'protect',
      });
      if (!ok) return;
    }

    setItems((prev) => {
      const currentItem = prev[moduleKey] ?? emptyItem(moduleKey);
      return { ...prev, [moduleKey]: { ...currentItem, [action]: !currentItem[action] } };
    });
    setIsDirty(true);
  }

  async function handleSave(): Promise<void> {
    if (roleId === null) return;
    setIsSaving(true);
    try {
      await rolesApi.updatePermissionMatrix(roleId, Object.values(items));
      setIsDirty(false);
      const roleName = roles.find((role) => role.id === roleId)?.name ?? 'role ini';
      toast.success(`Berhasil memberi akses kepada "${roleName}" disimpan.`);
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal menyimpan pemberi akses.');
    } finally {
      setIsSaving(false);
    }
  }

  const modules = PERMISSION_MODULES[tab];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Perizinan Hak Akses User</h2>
          <p className="text-xs text-textMuted">
            Atur hak akses tiap modul berdasarkan role ataupun username.
            kamu bisa mengatur di sini.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 rounded-full bg-neutralBg p-1 text-xs">
            <button
              type="button"
              onClick={() => setLookupMode('role')}
              className={clsx(
                'rounded-full px-3 py-1 font-semibold transition-colors',
                lookupMode === 'role' ? 'bg-accent text-white' : 'text-textMuted hover:text-text',
              )}
            >
              Per Role
            </button>
            <button
              type="button"
              onClick={() => setLookupMode('username')}
              className={clsx(
                'rounded-full px-3 py-1 font-semibold transition-colors',
                lookupMode === 'username' ? 'bg-accent text-white' : 'text-textMuted hover:text-text',
              )}
            >
              Cari Username
            </button>
          </div>
          {lookupMode === 'role' ? (
            <Select
              value={roleId !== null ? String(roleId) : ''}
              onChange={(event) => setRoleId(Number(event.target.value))}
              options={roles
                .filter((r) => r.name !== 'super_admin')
                .map((r) => ({ label: r.name, value: String(r.id) }))}
              className="w-40"
            />
          ) : (
            <Select
              value={selectedUsername}
              onChange={(event) => setSelectedUsername(event.target.value)}
              placeholder="Pilih username"
              options={allUsers
                .filter((u) => u.role !== 'super_admin')
                .map((u) => ({ label: u.username, value: u.username }))}
              className="w-48"
            />
          )}
        </div>
      </div>

      {lookupMode === 'username' && selectedUsername ? (
        <p className="rounded-md bg-infoBg px-3 py-2 text-xs text-infoText">
          Menampilkan izin role <strong>{roles.find((r) => r.id === roleId)?.name ?? '...'}</strong> (role
          milik <strong>{selectedUsername}</strong>) Mengatur di sistem masih PER ROLE, jadi mengubah
          toggle di bawah akan berlaku untuk SEMUA user dengan role/username yang sama, bukan cuma{' '}
          {selectedUsername} sendirian.
        </p>
      ) : null}

      <div className="flex gap-1 rounded-full bg-neutralBg p-1 self-start">
        {PERMISSION_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              tab === t.key ? 'bg-accent text-white' : 'text-textMuted hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-auto rounded-md border border-borderSoft">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="whitespace-nowrap bg-surfaceAlt px-3 py-2 font-semibold shadow-[0_1px_0_0_var(--color-borderSoft)]">
                Modul
              </th>
              {ACTION_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap bg-surfaceAlt px-3 py-2 text-center font-semibold shadow-[0_1px_0_0_var(--color-borderSoft)]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={ACTION_COLUMNS.length + 1} className="px-3 py-6 text-center text-xs text-textMuted">
                  Memuat matrix akses...
                </td>
              </tr>
            ) : (
              modules.map((mod) => {
                const item = items[mod.module] ?? emptyItem(mod.module);
                return (
                  <tr key={mod.key} className="border-t border-borderSoft">
                    <td className="px-3 py-2 font-medium text-text">{mod.label}</td>
                    {ACTION_COLUMNS.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-center">
                        <PermissionPill
                          checked={item[col.key]}
                          onChange={() => toggle(mod.module, mod.label, col.key)}
                          disabled={roleId === null || isSaving}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={isSaving} disabled={!isDirty || roleId === null}>
          Simpan Perubahan
        </Button>
      </div>
    </Card>
  );
}
