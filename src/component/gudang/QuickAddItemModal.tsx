'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/component/ui/Modal';
import { Button } from '@/component/ui/Button';
import { Input, Select, NumberField, CurrencyField } from '@/component/ui/FormControls';
import { itemsApi, type KategoriRaw } from '@/lib/api/modules';
import { mapBarangToItem } from '@/lib/api/mappers';
import { HttpError } from '@/lib/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { Item } from '@/types';

interface SatuanOption {
  id: string | number;
  nama: string;
}

interface QuickAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: Item) => void;
  kategoriList?: KategoriRaw[];
  satuanList?: SatuanOption[];
}

const EMPTY_FORM = {
  name: '',
  gudang: '',
  sku: '',
  categoryId: '',
  unitId: '',
  price: 0,
  minStock: 0,
  merek: '',
  tipe: '',
  isSerialized: false,
};

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  return fallback;
}

export function QuickAddItemModal({
  isOpen,
  onClose,
  onCreated,
  kategoriList,
  satuanList,
}: QuickAddItemModalProps): React.JSX.Element {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

  function handleClose(): void {
    setForm(EMPTY_FORM);
    onClose();
  }

  async function generateSku(categoryId?: string, tipe?: string, merek?: string): Promise<void> {
    setIsGeneratingSku(true);
    try {
      const { sku } = await itemsApi.nextSku(categoryId || undefined, tipe || undefined, merek || undefined);
      setForm((prev) => ({ ...prev, sku }));
    } catch {
    } finally {
      setIsGeneratingSku(false);
    }
  }

  function handleCategoryChange(categoryId: string): void {
    setForm((prev) => ({ ...prev, categoryId }));
    void generateSku(categoryId, form.tipe, form.merek);
  }

  function handleTipeChange(tipe: string): void {
    setForm((prev) => ({ ...prev, tipe }));
    void generateSku(form.categoryId, tipe, form.merek);
  }

  function handleMerekChange(merek: string): void {
    setForm((prev) => ({ ...prev, merek }));
    void generateSku(form.categoryId, form.tipe, merek);
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) {
      toast.error('Nama barang wajib diisi.');
      return;
    }
    if (!form.categoryId) {
      toast.error('Kategori wajib dipilih.');
      return;
    }
    if (!form.unitId) {
      toast.error('Satuan wajib dipilih.');
      return;
    }
    if (!form.sku.trim()) {
      toast.error('SKU wajib diisi (atau tunggu saran otomatis).');
      return;
    }
    setIsSaving(true);
    try {
      const createdRaw = await itemsApi.create({ ...form, stock: 0, deskripsi: '' });
      const created = mapBarangToItem(createdRaw);
      if (created.approvalStatus === 'menunggu') {
        toast.success(
          `Pengajuan "${created.name}" terkirim, tapi masih menunggu persetujuan super admin — belum bisa dipilih di dokumen ini sampai disetujui.`,
        );
        handleClose();
        return;
      }
      toast.success(`Barang baru "${created.name}" berhasil dibuat, langsung dipilih di baris ini.`);
      onCreated(created);
      handleClose();
    } catch (err) {
      toast.error(friendlyError(err, 'Gagal membuat barang baru.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Tambah Barang Baru (cepat)"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Batal
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Simpan &amp; Pilih
          </Button>
        </>
      }
    >
      <p className="-mt-1 text-xs text-textMuted">
        Barang baru ini langsung terpilih di baris yang sedang diisi. Stok awalnya 0 — nanti
        bertambah otomatis begitu dokumen ini diselesaikan.
        {user?.role === 'karyawan' ? (
          <>
            {' '}
            Karena akun ini role karyawan, barang baru perlu disetujui super admin dulu sebelum
            bisa dipilih.
          </>
        ) : null}
      </p>
      <Input
        label="Nama Barang"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Kategori"
          value={form.categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          placeholder="Pilih kategori"
          options={(kategoriList ?? []).map((k) => ({ label: k.nama, value: String(k.id) }))}
        />
        <Select
          label="Satuan"
          value={form.unitId}
          onChange={(e) => setForm((prev) => ({ ...prev, unitId: e.target.value }))}
          placeholder="Pilih satuan"
          options={(satuanList ?? []).map((s) => ({ label: s.nama, value: String(s.id) }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Merek (opsional)"
          value={form.merek}
          onChange={(e) => handleMerekChange(e.target.value)}
        />
        <Input
          label="Tipe (opsional)"
          value={form.tipe}
          onChange={(e) => handleTipeChange(e.target.value)}
        />
      </div>
      <Input
        label={isGeneratingSku ? 'SKU (membuat saran otomatis...)' : 'SKU'}
        value={form.sku}
        onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <CurrencyField
          label="Harga (opsional)"
          value={form.price}
          onValueChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
        />
        <NumberField
          label="Stok Minimum (opsional)"
          value={form.minStock}
          onValueChange={(value) => setForm((prev) => ({ ...prev, minStock: value }))}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={form.isSerialized}
          onChange={(e) => setForm((prev) => ({ ...prev, isSerialized: e.target.checked }))}
          className="h-4 w-4"
        />
        Barang ini pakai nomor seri (serial number) per unit
      </label>
    </Modal>
  );
}