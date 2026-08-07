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
import { tasksApi } from '@/lib/api/modules';
import { useResourceList } from '@/lib/hooks/useResourceList';
import { SEED_TASKS } from '@/lib/data/sample-data';
import { formatDate } from '@/lib/utils/format';
import { TASK_PRIORITY_META, TASK_STATUS_META } from '@/lib/utils/status';
import type { Task, TaskPriority } from '@/types';

const EMPTY_FORM: Partial<Task> = { title: '', assignee: '', priority: 'sedang', status: 'baru' };

function TaskManagementBody(): React.JSX.Element {
  const { rows, isLoading, mutate } = useResourceList('tasks', tasksApi, SEED_TASKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Task>>(EMPTY_FORM);

  async function handleSave(): Promise<void> {
    try {
      await tasksApi.create(form as Task);
    } finally {
      await mutate();
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
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
  ];

  return (
    <PageShell
      title="Task Management"
      breadcrumb="Manajemen / Task Manajemen"
      action={<Button onClick={() => setIsModalOpen(true)}>+ Tugas Baru</Button>}
    >
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
      <DataTable
        title="Daftar Tugas Tim"
        description="Penugasan operasional untuk Admin & Karyawan"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
      />

      <Modal
        isOpen={isModalOpen}
        title="Tugas Baru"
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
          label="Judul Tugas"
          value={form.title ?? ''}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Input
          label="Ditugaskan ke"
          value={form.assignee ?? ''}
          onChange={(event) => setForm({ ...form, assignee: event.target.value })}
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
    </PageShell>
  );
}

export function TaskManagementContent(): React.JSX.Element {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <TaskManagementBody />
    </RoleGuard>
  );
}
