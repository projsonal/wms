'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { Card } from '@/component/ui/Card';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { PermissionMatrixCard } from '@/component/content/PermissionMatrixCard';
import { usersApi, dashboardApi, assetsApi, type ManagedUserPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { HttpError } from '@/lib/api/client';
import { listErrorMessage } from '@/lib/utils/errors';
import { PERMISSION_MODULES } from '@/lib/data/permission-modules';
import { ROLE_LABEL } from '@/auth/roles';
import { formatDate } from '@/lib/utils/format';
import { ASSET_STATUS_META, JENIS_ASET_META } from '@/lib/utils/status';
import type { ActivityItem } from '@/component/roles_dashboard/RecentActivityCard';
import type { ManagedUser, UserRole } from '@/types';

const EMPTY_FORM: ManagedUserPayload = { name: '', username: '', email: '', role: 'karyawan', password: '' };

const TOTAL_MODUL_TERDAFTAR = Object.values(PERMISSION_MODULES).reduce(
  (sum, mods) => sum + mods.length,
  0,
);

/** "Aset Terbaru" — REAL, memakai GET /aset (data yang sama dipakai
 * halaman Manajemen Aset Gudang), diurutkan dari yang terbaru ditambahkan
 * supaya perubahan lapangan terbaru tampil duluan. */
function RecentAssetsCard(): React.JSX.Element {
  const { data: result, error } = useSWR('user-mgmt-recent-assets', () => assetsApi.list({ pageSize: 8 }), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  function renderBody(): React.JSX.Element {
    if (error) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Gagal memuat daftar aset.
        </p>
      );
    }
    if (!result) {
      return <p className="text-xs text-textMuted">Memuat aset...</p>;
    }
    const assets = [...result.data].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (assets.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Belum ada aset tercatat.
        </p>
      );
    }
    return (
      <ul className="flex max-h-64 flex-col gap-3 overflow-auto pr-1">
        {assets.map((asset) => {
          const statusMeta = ASSET_STATUS_META[asset.status];
          const jenisMeta = JENIS_ASET_META[asset.jenisAset];
          return (
            <li key={asset.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-text">{asset.nama}</p>
                <p className="text-xs text-textMuted">
                  {jenisMeta?.label ?? asset.jenisAset} • {asset.labelRsd ?? asset.kodeBa} • {asset.gudangNama}
                </p>
              </div>
              <Badge label={statusMeta.label} variant={statusMeta.variant} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Aset Terbaru</h2>
        <p className="text-xs text-textMuted">Daftar aset gudang yang baru ditambahkan</p>
      </div>
      {renderBody()}
    </Card>
  );
}

/** "Ringkasan Aset Gudang" — REAL, memakai GET /aset/summary. Menunjukkan
 * komposisi jumlah aset per jenis (tiang/odc/ont/odp/olt/transportasi). */
function AssetSummaryCard(): React.JSX.Element {
  const { data: summary, error } = useSWR('user-mgmt-asset-summary', () => assetsApi.summary(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  function renderBody(): React.JSX.Element {
    if (error) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Gagal memuat ringkasan aset.
        </p>
      );
    }
    if (!summary) {
      return <p className="text-xs text-textMuted">Memuat ringkasan...</p>;
    }
    if (summary.total === 0) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Belum ada aset yang tercatat sama sekali.
        </p>
      );
    }
    return (
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.tiang}</p>
          <p className="text-xs text-textMuted">Tiang</p>
        </div>
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.odc}</p>
          <p className="text-xs text-textMuted">ODC</p>
        </div>
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.ont}</p>
          <p className="text-xs text-textMuted">ONT</p>
        </div>
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.odp}</p>
          <p className="text-xs text-textMuted">ODP</p>
        </div>
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.olt}</p>
          <p className="text-xs text-textMuted">OLT</p>
        </div>
        <div className="rounded-md border border-borderSoft p-3">
          <p className="text-xl font-bold text-text">{summary.transportasi}</p>
          <p className="text-xs text-textMuted">Transportasi</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Ringkasan Aset Gudang</h2>
        <p className="text-xs text-textMuted">Jumlah aset per jenis saat ini</p>
      </div>
      {renderBody()}
    </Card>
  );
}

const ACTIVITY_DOT_COLOR = ['bg-infoText', 'bg-successText', 'bg-warningText', 'bg-dangerText'];

/** "Monitoring User" — REAL, memakai endpoint /dashboard/activity yang
 * sama dengan kartu Aktivitas Terbaru di dashboard admin. */
function MonitoringUserCard(): React.JSX.Element {
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    dashboardApi
      .activity()
      .then(setActivity)
      .catch(() => setError(true));
  }, []);

  function renderBody(): React.JSX.Element {
    if (error) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Gagal memuat log aktivitas.
        </p>
      );
    }
    if (activity === null) {
      return <p className="text-xs text-textMuted">Memuat aktivitas...</p>;
    }
    if (activity.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Belum ada aktivitas tercatat.
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-3 max-h-64 overflow-auto pr-1">
        {activity.slice(0, 8).map((item, index) => (
          <motion.li
            key={item.id}
            className="flex gap-2 text-sm"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_DOT_COLOR[index % ACTIVITY_DOT_COLOR.length]}`}
            />
            <div>
              <p className="text-text">{item.message}</p>
              <p className="text-xs text-textMuted">{item.timeAgo}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Monitoring User</h2>
        <p className="text-xs text-textMuted">Log aktivitas real-time</p>
      </div>
      {renderBody()}
    </Card>
  );
}

function UserManagementBody(): React.JSX.Element {
  // refreshIntervalMs=15000 -> status login (kolom "Status") terlihat
  // "real-time" tanpa perlu reload manual halaman.
  const { user } = useAuth();
  const { rows, isLoading, error, mutate } = useResourceList('users', usersApi, undefined, 15000);
  const { requestExport, dialog: exportDialog } = useExportFormat();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManagedUserPayload>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: ManagedUser): void {
    setEditingId(row.id);
    setForm({ name: row.name, username: row.username, email: row.email, role: row.role, password: '' });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!editingId && (!form.password || form.password.length < 8)) {
      toast.error('Password wajib diisi (minimal 8 karakter) untuk user baru.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await usersApi.update(editingId, form);
        toast.success('User berhasil diperbarui.');
      } else {
        await usersApi.create(form);
        toast.success('User baru berhasil didaftarkan.');
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal menyimpan user.');
    } finally {
      setIsSaving(false);
      await mutate();
    }
  }

  async function handleDelete(row: ManagedUser): Promise<void> {
    const ok = await confirm({
      title: 'Nonaktifkan User',
      message: `Akun "${row.name}" akan dinonaktifkan dan tidak bisa login lagi (bukan dihapus permanen, riwayat transaksinya tetap tersimpan). Lanjutkan?`,
      confirmLabel: 'Ya, Nonaktifkan',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await usersApi.remove(row.id);
      toast.success('User berhasil dinonaktifkan.');
      await mutate();
    } catch {
      toast.error('Gagal menonaktifkan user.');
    }
  }

  const USER_EXPORT_COLUMNS = [
    { header: 'Nama', accessor: (r: ManagedUser) => r.name },
    { header: 'Username', accessor: (r: ManagedUser) => r.username },
    { header: 'Email', accessor: (r: ManagedUser) => r.email },
    { header: 'Role', accessor: (r: ManagedUser) => ROLE_LABEL[r.role] },
    { header: 'Status', accessor: (r: ManagedUser) => r.status },
  ];
  const USER_PDF_META = {
    title: 'Rekap Data Gudang — Manajemen User',
    subtitle: 'Manajemen / Manajemen User',
    description: 'Daftar akun pengguna WMS-RSD beserta peran (role) dan status keaktifan masing-masing akun.',
  };

  const columns: DataTableColumn<ManagedUser>[] = [
    { key: 'name', header: 'Nama', render: (row) => row.name },
    { key: 'username', header: 'Username', render: (row) => row.username },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'role', header: 'Role', render: (row) => ROLE_LABEL[row.role] },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.isOnline ? (
          <Badge label="Aktif" variant="success" />
        ) : (
          <Badge label="Nonaktif" variant="neutral" />
        ),
    },
    {
      key: 'last-login',
      header: 'Login Terakhir',
      render: (row) => (row.lastLogin ? formatDate(row.lastLogin) : '-'),
    },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            title="Edit"
            className="rounded p-1 text-textMuted hover:bg-neutralBg hover:text-accentDark"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row)}
            title="Nonaktifkan"
            className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Manajemen User" breadcrumb="Manajemen / Manajemen User">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <PermissionMatrixCard />
        <RecentAssetsCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AssetSummaryCard />
        <MonitoringUserCard />
      </div>

      <StatsRow
        stats={[
          {
            id: 'modul-terdaftar',
            label: 'Modul Terdaftar',
            value: TOTAL_MODUL_TERDAFTAR,
            helperText: 'Total modul pada matrix perizinan',
          },
          {
            id: 'user-online',
            label: 'User Online',
            value: rows.filter((r) => r.isOnline).length,
            helperText: 'Punya sesi login aktif saat ini',
          },
        ]}
      />

      <DataTable
        title="Daftar Pengguna Sistem"
        description="Kelola akun dan hak akses pengguna WMS-RSD"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={(action) => {
          if (action === 'add') openCreateModal();
          if (action === 'export') {
            requestExport(rows, USER_EXPORT_COLUMNS, 'daftar-user', USER_PDF_META);
          }
          if (action === 'print') {
            printRowsToPdf(rows, USER_EXPORT_COLUMNS, { ...USER_PDF_META, generatedBy: user?.fullName });
          }
        }}
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah User' : 'Tambah User'}
        onClose={() => setIsModalOpen(false)}
        onEnterSubmit={handleSave}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Simpan
            </Button>
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
        {!editingId ? (
          <Input
            label="Password"
            type="password"
            placeholder="Minimal 8 karakter"
            value={form.password ?? ''}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        ) : null}
      </Modal>
      {exportDialog}
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
