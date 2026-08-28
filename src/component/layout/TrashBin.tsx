'use client';

import { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { useConfirm } from '@/component/ui/ConfirmDialog';
import { trashApi, type TrashItem } from '@/lib/api/modules';
import { friendlyError } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const TYPE_LABEL: Record<TrashItem['type'], string> = {
  aset: 'Aset Gudang',
  barang: 'Barang',
  gudang: 'Gudang',
  barang_rusak: 'Barang Rusak',
};

export function TrashBin(): React.JSX.Element | null {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canAccess = user?.role === 'super_admin' || user?.role === 'admin';

  async function loadItems(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await trashApi.list();
      setItems(res);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memuat tempat sampah.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggle(): void {
    const next = !isOpen;
    setIsOpen(next);
    if (next) loadItems();
  }

  async function handleRestore(item: TrashItem): Promise<void> {
    const key = `${item.type}-${item.id}`;
    setBusyKey(key);
    try {
      await trashApi.restore(item.type, item.id);
      toast.success(`${item.judul} berhasil dipulihkan.`);
      setItems((prev) => prev?.filter((i) => !(i.type === item.type && i.id === item.id)) ?? null);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal memulihkan data.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePurge(item: TrashItem): Promise<void> {
    const ok = await confirm({
      title: 'Hapus Permanen?',
      message: `"${item.judul}" akan dihapus PERMANEN dan TIDAK BISA dipulihkan lagi. Yakin lanjut?`,
      confirmLabel: 'Ya, Hapus Permanen',
      variant: 'danger',
    });
    if (!ok) return;
    const key = `${item.type}-${item.id}`;
    setBusyKey(key);
    try {
      await trashApi.purge(item.type, item.id);
      toast.success(`${item.judul} berhasil dihapus permanen.`);
      setItems((prev) => prev?.filter((i) => !(i.type === item.type && i.id === item.id)) ?? null);
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal menghapus permanen.'));
    } finally {
      setBusyKey(null);
    }
  }

  if (!canAccess) {
    return null;
  }

  let itemsContent: React.ReactNode;
  if (isLoading) {
    itemsContent = <p className="px-4 py-6 text-center text-xs text-textMuted">Memuat...</p>;
  } else if (!items || items.length === 0) {
    itemsContent = <p className="px-4 py-6 text-center text-xs text-textMuted">Tempat sampah kosong.</p>;
  } else {
    itemsContent = items.map((item) => {
      const key = `${item.type}-${item.id}`;
      const busy = busyKey === key;
      return (
        <div key={key} className="flex items-center justify-between gap-2 border-b border-borderSoft px-4 py-3 last:border-0">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-text">{item.judul}</p>
            <p className="text-[10px] text-textMuted">
              {TYPE_LABEL[item.type]}
              {item.subjudul ? ` · ${item.subjudul}` : ''} · dihapus {formatDate(item.deletedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handleRestore(item)}
              disabled={busy}
              title="Pulihkan"
              className="rounded p-1.5 text-textMuted hover:bg-successBg hover:text-successText disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handlePurge(item)}
              disabled={busy}
              title="Hapus Permanen"
              className="rounded p-1.5 text-textMuted hover:bg-dangerBg hover:text-dangerText disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Tempat Sampah"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft text-text hover:bg-surfaceAlt"
      >
        <Trash2 className="h-4 w-4" />
        {items && items.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-textMuted px-1 text-[10px] font-bold text-white">
            {items.length > 99 ? '99+' : items.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Tutup tempat sampah"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[92vw] rounded-lg border border-borderSoft bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-borderSoft px-4 py-3">
              <h3 className="text-sm font-bold text-text">Tempat Sampah</h3>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Tutup" className="text-textMuted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {itemsContent}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
