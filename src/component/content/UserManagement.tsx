'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Pencil, Trash2, Monitor } from 'lucide-react';
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
import { usersApi, assetsApi, type ManagedUserPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { HttpError } from '@/lib/api/client';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { PERMISSION_MODULES } from '@/lib/data/permission-modules';
import { ROLE_LABEL } from '@/auth/roles';
import { formatDate } from '@/lib/utils/format';
import { ASSET_STATUS_META, JENIS_ASET_META } from '@/lib/utils/status';
import type { ManagedUser, UserDeviceSession, UserRole } from '@/types';

const EMPTY_FORM: ManagedUserPayload = { name: '', username: '', email: '', phoneNumber: '', role: 'karyawan', password: '' };

const TOTAL_MODUL_TERDAFTAR = Object.values(PERMISSION_MODULES).reduce(
  (sum, mods) => sum + mods.length,
  0,
);

function RecentAssetsCard(): React.JSX.Element {
  const { data: result, error } = useSWR('user-mgmt-recent-assets', () => assetsApi.list({ pageSize: 8 }), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  function renderBody(): React.JSX.Element {
    if (error) {
      return (
        <p className="rounded-md border border-dashed border-borderSoft bg-neutralBg p-6 text-center text-xs text-textMuted">
          Gagal memuat daftar aset, silakan coba lagi.
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
        <p className="text-xs text-textMuted">Silakan Daftarkan aset barang ke gudang yang ingin ditambahkan</p>
      </div>
      {renderBody()}
    </Card>
  );
}

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
          Belum ada data aset barang yang tercatat sama sekali.
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

function MonitoringUserCard({ rows }: Readonly<{ rows: ManagedUser[] }>): React.JSX.Element {
  const online = rows.filter((r) => r.isOnline);
  const recentLogins = [...rows]
    .filter((r) => r.lastLogin)
    .sort((a, b) => new Date(b.lastLogin ?? 0).getTime() - new Date(a.lastLogin ?? 0).getTime())
    .slice(0, 6);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Monitoring User</h2>
        <p className="text-xs text-textMuted">Siapa yang online sekarang & login terakhir tiap user</p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-textMuted">
          Sedang Online ({online.length})
        </h3>
        {online.length === 0 ? (
          <p className="text-xs text-textMuted">Tidak ada user yang sedang login.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {online.map((u) => (
              <li key={u.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-successText" />
                <span className="text-text">{u.name}</span>
                <span className="text-xs text-textMuted">({ROLE_LABEL[u.role]})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-borderSoft pt-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-textMuted">Login Terakhir</h3>
        {recentLogins.length === 0 ? (
          <p className="text-xs text-textMuted">Belum ada riwayat login.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-3 overflow-auto pr-1">
            {recentLogins.map((u, index) => (
              <motion.li
                key={u.id}
                className="flex items-center justify-between gap-2 text-sm"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_DOT_COLOR[index % ACTIVITY_DOT_COLOR.length]}`}
                  />
                  <span className="text-text">{u.name}</span>
                </span>
                <span className="text-xs text-textMuted">{u.lastLogin ? formatDate(u.lastLogin) : '-'}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UserManagementBody(): React.JSX.Element {

  const { user } = useAuth();
  const { rows, isLoading, error, mutate } = useResourceList('users', usersApi, undefined, 15000);
  const { requestExport, dialog: exportDialog } = useExportFormat();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManagedUserPayload>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete(selectedRows: ManagedUser[]): Promise<void> {
    if (!isBulkMode || selectedRows.length === 0) {
      toast('Silakan Aktifkan "Modify" terlebih dahulu untuk memilih salah satu data atau beberapa yang mau dinonaktifkan.');
      return;
    }
    const ok = await confirm({
      title: 'Nonaktifkan User Terpilih',
      message: `${selectedRows.length} akun terpilih akan dinonaktifkan dan tidak bisa login lagi (bukan dihapus permanen, riwayat transaksinya tetap tersimpan). Lanjutkan?`,
      confirmLabel: 'Ya, Nonaktifkan',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Promise.all(selectedRows.map((r) => usersApi.remove(r.id)));
      toast.success(`${selectedRows.length} user berhasil dinonaktifkan.`);
      setSelectedIds(new Set());
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'beberapa data gagal dinonaktifkan.'));
    }
  }

  function handleBulkChange(selectedRows: ManagedUser[]): void {
    if (!isBulkMode) {
      toast('Silakan Aktifkan "Modify" terlebih dahulu untuk memilih salah satu data yang mau diubah.');
      return;
    }
    if (selectedRows.length !== 1) {
      toast('Silakan pilih salah SATU baris data untuk diubah.');
      return;
    }
    openEditModal(selectedRows[0]);
  }

  const [devicesUser, setDevicesUser] = useState<ManagedUser | null>(null);
  const [devices, setDevices] = useState<UserDeviceSession[] | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  async function openDevicesModal(row: ManagedUser): Promise<void> {
    setDevicesUser(row);
    setDevices(null);
    setIsLoadingDevices(true);
    try {
      const list = await usersApi.listSessions(row.id);
      setDevices(list);
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal memuat daftar perangkat.');
      setDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  }

  async function handleRevokeSession(session: UserDeviceSession): Promise<void> {
    if (!devicesUser) return;
    const ok = await confirm({
      title: 'Cabut Sesi',
      message: `Paksa logout "${devicesUser.name}" dari perangkat ini (${session.browser ?? 'browser tidak diketahui'} / ${session.os ?? 'OS tidak diketahui'})?`,
      confirmLabel: 'Ya, Cabut',
      variant: 'danger',
    });
    if (!ok) return;
    setRevokingSessionId(session.id);
    try {
      await usersApi.revokeSession(devicesUser.id, session.id);
      toast.success('Sesi berhasil dicabut, perangkat kamu otomatis keluar.');
      setDevices((prev) => (prev ?? []).filter((s) => s.id !== session.id));
    } catch (err) {
      toast.error(err instanceof HttpError ? err.message : 'Gagal mencabut sesi.');
    } finally {
      setRevokingSessionId(null);
    }
  }

  function renderDevicesBody(): React.JSX.Element {
    if (isLoadingDevices) {
      return <p className="text-xs text-textMuted">Memuat daftar perangkat…</p>;
    }
    if (!devices || devices.length === 0) {
      return (
        <p className="text-xs text-textMuted">
          Tidak ada sesi/perangkat yang aktif di akun ini, sedang tidak login di perangkat mana pun.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {devices.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-md border border-borderSoft p-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text">
                {session.browser ?? 'Browser tidak diketahui'}
                {session.browserVersion ? ` ${session.browserVersion}` : ''}
                {' · '}
                {session.os ?? 'OS tidak diketahui'}
                {session.osVersion ? ` ${session.osVersion}` : ''}
              </span>
              <span className="text-xs text-textMuted">
                {session.deviceType ?? 'Perangkat tidak diketahui'}
                {session.location ? ` · ${session.location}` : ''}
                {session.ipAddress ? ` · ${session.ipAddress}` : ''}
              </span>
              <span className="text-xs text-textMuted">Login sejak {formatDate(session.createdAt)}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => handleRevokeSession(session)}
              loading={revokingSessionId === session.id}
            >
              Cabut
            </Button>
          </div>
        ))}
      </div>
    );
  }

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: ManagedUser): void {
    setEditingId(row.id);
    setForm({
      name: row.name,
      username: row.username,
      email: row.email,
      phoneNumber: row.phoneNumber ?? '',
      role: row.role,
      password: '',
    });
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
    { header: 'No. Telepon', accessor: (r: ManagedUser) => r.phoneNumber ?? '-' },
    { header: 'Role', accessor: (r: ManagedUser) => ROLE_LABEL[r.role] },
    { header: 'Status', accessor: (r: ManagedUser) => r.status },
  ];
  const USER_PDF_META = {
    title: 'Rekap Data Manajemen User',
    subtitle: 'Manajemen User',
    description: 'Pengumpulan data akun pengguna aplikasi WMS-RSD beserta peran dan status keaktifan masing-masing akun.',
  };

  const columns: DataTableColumn<ManagedUser>[] = [
    ...(isBulkMode
      ? [
          {
            key: 'select',
            header: '',
            render: (row: ManagedUser) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelected(row.id)}
                className="h-4 w-4"
              />
            ),
          } satisfies DataTableColumn<ManagedUser>,
        ]
      : []),
    { key: 'name', header: 'Nama', render: (row) => row.name },
    { key: 'username', header: 'Username', render: (row) => row.username },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'phone', header: 'No. Telepon', render: (row) => row.phoneNumber || '-' },
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
            onClick={() => openDevicesModal(row)}
            title="Lihat Perangkat"
            className="rounded p-1 text-textMuted hover:bg-infoBg hover:text-infoText"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
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
        <MonitoringUserCard rows={rows} />
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
        description={
          isBulkMode
            ? `Silakan aktifkan Mode Modify untuk memilih ${selectedIds.size} data per baris. Pilih data per baris lalu gunakan Change/Delete di atas.`
            : 'Kelola akun dan hak akses pengguna WMS-RSD'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={(action) => {
          const selectedRows = rows.filter((r) => selectedIds.has(r.id));
          if (action === 'add') openCreateModal();
          if (action === 'export') {
            requestExport(rows, USER_EXPORT_COLUMNS, 'daftar-user', USER_PDF_META);
          }
          if (action === 'print') {
            printRowsToPdf(rows, USER_EXPORT_COLUMNS, { ...USER_PDF_META, generatedBy: user?.fullName });
          }
          if (action === 'modify') {
            setIsBulkMode((prev) => !prev);
            setSelectedIds(new Set());
          }
          if (action === 'change') handleBulkChange(selectedRows);
          if (action === 'delete') handleBulkDelete(selectedRows);
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
        <Input
          label="No. Telepon"
          placeholder="08xxxxxxx"
          value={form.phoneNumber ?? ''}
          onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
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

      <Modal
        isOpen={devicesUser !== null}
        title={`Perangkat Login — ${devicesUser?.name ?? ''}`}
        onClose={() => setDevicesUser(null)}
        footer={
          <Button variant="secondary" onClick={() => setDevicesUser(null)}>
            Tutup
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-textMuted">
            Daftar perangkat yang sedang login. Apabila kamu Cabut sesi maka akan otomatis keluar akun.
          </p>
          {renderDevicesBody()}
        </div>
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
