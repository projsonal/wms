'use client';

import { useState } from 'react';
import { PageShell } from '@/component/layout/PageShell';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { usersApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_USERS } from '@/lib/data/sample-data';
import { ROLE_LABEL } from '@/auth/roles';
import { formatDate } from '@/lib/utils/format';
import { GENERIC_STATUS_META } from '@/lib/utils/status';
import type { ManagedUser, UserRole } from '@/types';

const EMPTY_FORM: Partial<ManagedUser> = { name: '', username: '', email: '', role: 'karyawan' };

function UserManagementBody(): React.JSX.Element {
  const { rows, isLoading, mutate } = useResourceList('users', usersApi, SEED_USERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<ManagedUser>>(EMPTY_FORM);

  async function handleSave(): Promise<void> {
    try {
      await usersApi.create(form as ManagedUser);
    } finally {
      await mutate();
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
    }
  }

  const columns: DataTableColumn<ManagedUser>[] = [
    { key: 'name', header: 'Nama', render: (row) => row.name },
    { key: 'username', header: 'Username', render: (row) => row.username },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'role', header: 'Role', render: (row) => ROLE_LABEL[row.role] },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = GENERIC_STATUS_META[row.status];
        return meta ? <Badge label={meta.label} variant={meta.variant} /> : row.status;
      },
    },
    {
      key: 'last-login',
      header: 'Login Terakhir',
      render: (row) => (row.lastLogin ? formatDate(row.lastLogin) : '-'),
    },
  ];

  return (
    <PageShell
      title="Manajemen User"
      breadcrumb="Manajemen / Manajemen User"
      action={<Button onClick={() => setIsModalOpen(true)}>+ Tambah User</Button>}
    >
      <StatsRow
        stats={[
          { id: 'total', label: 'Total User', value: rows.length },
          {
            id: 'super',
            label: 'Super Admin',
            value: rows.filter((r) => r.role === 'super_admin').length,
          },
          { id: 'admin', label: 'Admin', value: rows.filter((r) => r.role === 'admin').length },
          {
            id: 'karyawan',
            label: 'Karyawan',
            value: rows.filter((r) => r.role === 'karyawan').length,
          },
        ]}
      />
      <DataTable
        title="Daftar Pengguna Sistem"
        description="Kelola akun dan hak akses pengguna StokRSD WMS"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />

      <Modal
        isOpen={isModalOpen}
        title="Tambah User"
        onClose={() => setIsModalOpen(false)}
        onEnterSubmit={handleSave}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>Simpan</Button>
          </>
        }
      >
        <Input
          label="Nama Lengkap"
          value={form.name ?? ''}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          label="Username"
          value={form.username ?? ''}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
        />
        <Input
          label="Email"
          type="email"
          value={form.email ?? ''}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Select
          label="Role"
          value={form.role ?? 'karyawan'}
          onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
          options={[
            { label: 'Super Admin', value: 'super_admin' },
            { label: 'Admin', value: 'admin' },
            { label: 'Karyawan', value: 'karyawan' },
          ]}
        />
      </Modal>
    </PageShell>
  );
}

export function UserManagementContent(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <UserManagementBody />
    </RoleGuard>
  );
}
