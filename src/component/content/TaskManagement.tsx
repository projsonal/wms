'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CheckCircle2, PlayCircle, Trash2, Pencil } from 'lucide-react';
import { PageShell } from '@/component/layout/PageShell';
import { RoleGuard } from '@/component/layout/RoleGuard';
import { Badge } from '@/component/ui/Badge';
import { Button } from '@/component/ui/Button';
import { DataTable, type DataTableColumn } from '@/component/ui/DataTable';
import { Modal } from '@/component/ui/Modal';
import { Input, Select } from '@/component/ui/FormControls';
import { StatsRow } from '@/component/ui/StatsRow';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { tasksApi, usersApi, type TaskPayload } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { friendlyError, listErrorMessage } from '@/lib/utils/errors';
import { useExportFormat } from '@/lib/hooks/useExportFormat';
import { printRowsToPdf } from '@/lib/utils/export-pdf';
import { formatDate } from '@/lib/utils/format';
import { TASK_PRIORITY_META, TASK_STATUS_META } from '@/lib/utils/status';
import type { Task, TaskPriority } from '@/types';
import type { TableRowAction } from '@/component/ui/TableRowActionBar';

const EMPTY_FORM: Partial<TaskPayload> = { title: '', description: '', priority: 'sedang' };


function TaskManagementBody(): React.JSX.Element {
  const { user } = useAuth();
  const isStaff = user?.role === 'super_admin' || user?.role === 'admin';
  const { can } = usePermissions();
  const canUpdateStatus = isStaff || can('tasks', 'edit');
  const confirm = useConfirm();
  const { requestExport, dialog: exportDialog } = useExportFormat();

  const { rows, isLoading, error, mutate } = useResourceList('tasks', tasksApi);
  const { data: userList } = useSWR('users-for-tasks', () => usersApi.list({ pageSize: 200 }), {
    isPaused: () => !isStaff,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TaskPayload>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateModal(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(row: Task): void {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? '',
      assignedTo: Number(row.assigneeId),
      dueDate: row.dueDate.slice(0, 10),
      priority: row.priority,
    });
    setIsModalOpen(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.title || !form.assignedTo || !form.dueDate) {
      toast.error('Judul, penerima tugas, dan batas waktu wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: TaskPayload = {
        title: form.title,
        description: form.description ?? '',
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        priority: form.priority ?? 'sedang',
      };
      if (editingId) {
        await tasksApi.update(editingId, payload);
        toast.success('Tugas berhasil diperbarui.');
      } else {
        await tasksApi.create(payload);
        toast.success(`Tugas baru berhasil ditugaskan.`);
      }
      setIsModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menyimpan tugas.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetStatus(row: Task, status: 'proses' | 'selesai'): Promise<void> {
    try {
      await tasksApi.setStatus(row.id, status);
      toast.success(status === 'selesai' ? 'Tugas ditandai selesai.' : 'Tugas ditandai sedang dikerjakan.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memperbarui status tugas.'));
    }
  }

  async function handleDelete(row: Task): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Tugas',
      message: `Apakah yakin ingin menghapus data ini? (${row.title})`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await tasksApi.remove(row.id);
      toast.success('Tugas berhasil dihapus.');
      await mutate();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus tugas.'));
    }
  }

  const TASK_EXPORT_COLUMNS = [
    { header: 'Judul Tugas', accessor: (r: Task) => r.title },
    { header: 'Ditugaskan ke', accessor: (r: Task) => r.assignee },
    { header: 'Batas Waktu', accessor: (r: Task) => r.dueDate },
    { header: 'Prioritas', accessor: (r: Task) => r.priority },
    { header: 'Status', accessor: (r: Task) => r.status },
  ];
  const TASK_PDF_META = {
    title: 'Rekap Data Gudang — Daftar Tugas',
    subtitle: 'Manajemen / Task Manajemen',
    description: 'Daftar seluruh tugas yang ditugaskan ke tim operasional gudang, beserta batas waktu, prioritas, dan status pengerjaan.',
  };

  async function handleRowAction(action: TableRowAction): Promise<void> {
    if (action === 'add') openCreateModal();
    if (action === 'export') {
      requestExport(rows, TASK_EXPORT_COLUMNS, 'daftar-tugas', TASK_PDF_META);
    }
    if (action === 'print') {
      printRowsToPdf(rows, TASK_EXPORT_COLUMNS, { ...TASK_PDF_META, generatedBy: user?.fullName });
    }
  }

  const columns: DataTableColumn<Task>[] = [
    { key: 'title', header: 'Judul Tugas', render: (row) => row.title },
    { key: 'assignee', header: 'Ditugaskan ke', render: (row) => row.assignee },
    { key: 'due', header: 'Batas Waktu', render: (row) => formatDate(row.dueDate) },
    {
      key: 'priority',
      header: 'Prioritas',
      render: (row) => {
        const meta = TASK_PRIORITY_META[row.priority];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const meta = TASK_STATUS_META[row.status];
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'row-actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status !== 'selesai' && canUpdateStatus ? (
            <>
              {row.status !== 'proses' ? (
                <button
                  type="button"
                  onClick={() => handleSetStatus(row, 'proses')}
                  title="Tandai sedang dikerjakan"
                  className="rounded p-1 text-textMuted hover:bg-warningBg hover:text-warningText"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleSetStatus(row, 'selesai')}
                title="Tandai selesai"
                className="rounded p-1 text-textMuted hover:bg-successBg hover:text-successText"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {isStaff ? (
            <>
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
                title="Hapus"
                className="rounded p-1 text-textMuted hover:bg-dangerBg hover:text-dangerText"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Task Management" breadcrumb="Manajemen / Task Manajemen">
      <StatsRow
        stats={[
          { id: 'total', label: 'Total Tugas', value: rows.length },
          {
            id: 'proses',
            label: 'Sedang Dikerjakan',
            value: rows.filter((r) => r.status === 'proses').length,
          },
          {
            id: 'terlambat',
            label: 'Terlambat',
            value: rows.filter((r) => r.status === 'terlambat').length,
          },
          {
            id: 'selesai',
            label: 'Selesai',
            value: rows.filter((r) => r.status === 'selesai').length,
          },
        ]}
      />
      {/* Tombol "+Tambah" di header sengaja dihilangkan — pakai action bar
          geser (TableRowActionBar, tombol "Add") di dalam tabel, khusus
          super_admin/admin. Karyawan cukup lihat & update status tugasnya. */}
      <DataTable
        title="Daftar Tugas Tim"
        description={
          isStaff
            ? 'Penugasan operasional untuk Admin & Karyawan'
            : 'Tugas yang ditugaskan kepada Anda'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        errorMessage={listErrorMessage(error)}
        onRowAction={handleRowAction}
        module="tasks"
        // "Tambah Tugas" di backend WAJIB staff (onlyStaff DI ATAS izin
        // tambah — lihat RegisterRoutes di task_controller.go), jadi
        // tombol Add tetap disembunyikan total untuk karyawan walau
        // matrix "Tambah" di-ON-kan, supaya tidak menampilkan tombol yang
        // pasti ditolak backend. Export/Print aman diikutkan matrix biasa
        // karena read-only.
        visibleActions={isStaff ? undefined : ['export', 'print']}
      />

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Ubah Tugas' : 'Tugas Baru'}
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
          label="Judul Tugas"
          value={form.title ?? ''}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Input
          label="Deskripsi (opsional)"
          value={form.description ?? ''}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <Select
          label="Ditugaskan ke"
          value={form.assignedTo ? String(form.assignedTo) : ''}
          onChange={(event) => setForm({ ...form, assignedTo: Number(event.target.value) })}
          placeholder="Pilih user"
          options={(userList?.data ?? []).map((u) => ({ label: `${u.name} (${u.username})`, value: u.id }))}
        />
        <Input
          label="Batas Waktu"
          type="date"
          value={form.dueDate ?? ''}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
        />
        <Select
          label="Prioritas"
          value={form.priority ?? 'sedang'}
          onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}
          options={[
            { label: 'Rendah', value: 'rendah' },
            { label: 'Sedang', value: 'sedang' },
            { label: 'Tinggi', value: 'tinggi' },
          ]}
        />
      </Modal>
      {exportDialog}
    </PageShell>
  );
}

export function TaskManagementContent(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={['super_admin', 'admin', 'karyawan']}>
      <TaskManagementBody />
    </RoleGuard>
  );
}
