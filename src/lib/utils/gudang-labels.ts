
export const GUDANG_KODE_LABELS: Record<string, string> = {
  syt: 'Sayati',
  mgh: 'Manggahang',
  du: 'Dipatiukur',
  pasko: 'Pasirkoja',
  ckw: 'Cikawung',
  tms: 'Tamansari',
  skmd: 'Sukamandi',
};

export function resolveGudangLabel(kode?: string): string {
  if (!kode) return '-';
  const known = GUDANG_KODE_LABELS[kode.toLowerCase()];
  return known ? `${kode.toUpperCase()} (${known})` : kode.toUpperCase();
}
