import type {
  Delivery,
  InventoryRecord,
  Item,
  ManagedUser,
  PurchaseOrder,
  ReportRow,
  StatMetric,
  Supplier,
  Task,
  TrendPoint,
  Warehouse,
} from '@/types';
import type { ActivityItem } from '@/component/roles_dashboard/RecentActivityCard';

/* eslint-disable sonarjs/no-duplicate-string -- berkas data contoh: pengulangan nilai
   (mis. status "aktif", nama gudang) adalah representasi data yang sah, bukan
   duplikasi logika yang perlu diekstrak menjadi konstanta. */

/**
 * Data contoh dipakai sebagai `fallbackData` SWR agar antarmuka tetap
 * dapat ditinjau sebelum backend gostock terhubung. Saat API merespons,
 * data ini otomatis digantikan oleh data asli.
 */

export const SEED_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-1',
    name: 'Gudang Bandung Timur',
    code: 'WH-BDG-01',
    address: 'Jl. Soekarno Hatta No. 45, Bandung',
    capacity: 10000,
    usedCapacity: 8082,
    totalItems: 1284,
    picName: 'Rizky Ardiansyah',
    status: 'aktif',
    latitude: -6.9349,
    longitude: 107.6395,
  },
  {
    id: 'wh-2',
    name: 'Gudang Bandung Barat',
    code: 'WH-BDG-02',
    address: 'Jl. Cihampelas No. 12, Bandung',
    capacity: 8000,
    usedCapacity: 5310,
    totalItems: 902,
    picName: 'Dewi Lestari',
    status: 'aktif',
  },
  {
    id: 'wh-3',
    name: 'Gudang Cimahi',
    code: 'WH-CMH-01',
    address: 'Jl. Gatot Subroto No. 7, Cimahi',
    capacity: 6000,
    usedCapacity: 1980,
    totalItems: 415,
    picName: 'Fajar Nugraha',
    status: 'nonaktif',
  },
];

export const SEED_ITEMS: Item[] = [
  {
    id: 'itm-1',
    sku: 'BRG-0021',
    name: 'Beras Premium 5kg',
    category: 'Sembako',
    unit: 'Karung',
    stock: 320,
    minStock: 100,
    price: 68000,
    warehouseId: 'wh-1',
    warehouseName: 'Gudang Bandung Timur',
    status: 'tersedia',
    updatedAt: '2026-07-28',
  },
  {
    id: 'itm-2',
    sku: 'BRG-0044',
    name: 'Minyak Goreng 2L',
    category: 'Sembako',
    unit: 'Botol',
    stock: 48,
    minStock: 80,
    price: 32500,
    warehouseId: 'wh-1',
    warehouseName: 'Gudang Bandung Timur',
    status: 'menipis',
    updatedAt: '2026-07-30',
  },
  {
    id: 'itm-3',
    sku: 'BRG-0107',
    name: 'Galon Air Mineral 19L',
    category: 'Minuman',
    unit: 'Unit',
    stock: 0,
    minStock: 50,
    price: 21000,
    warehouseId: 'wh-2',
    warehouseName: 'Gudang Bandung Barat',
    status: 'habis',
    updatedAt: '2026-07-25',
  },
  {
    id: 'itm-4',
    sku: 'BRG-0158',
    name: 'Kardus Packing Sedang',
    category: 'Packaging',
    unit: 'Pcs',
    stock: 1520,
    minStock: 300,
    price: 4200,
    warehouseId: 'wh-2',
    warehouseName: 'Gudang Bandung Barat',
    status: 'tersedia',
    updatedAt: '2026-08-01',
  },
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'PT Sumber Makmur Sejahtera',
    contactPerson: 'Budi Santoso',
    phone: '0812-3456-7890',
    email: 'budi@sumbermakmur.co.id',
    address: 'Jl. Raya Industri No. 8, Bandung',
    totalOrders: 58,
    rating: 4.6,
    status: 'aktif',
  },
  {
    id: 'sup-2',
    name: 'CV Karya Distribusi Nusantara',
    contactPerson: 'Sri Handayani',
    phone: '0813-2211-9087',
    email: 'sri@karyadistribusi.id',
    address: 'Jl. Terusan Pasteur No. 100, Bandung',
    totalOrders: 34,
    rating: 4.2,
    status: 'aktif',
  },
  {
    id: 'sup-3',
    name: 'UD Berkah Logistik',
    contactPerson: 'Agus Wijaya',
    phone: '0857-6543-2190',
    email: 'agus@berkahlogistik.co.id',
    address: 'Jl. Ahmad Yani No. 55, Cimahi',
    totalOrders: 12,
    rating: 3.9,
    status: 'nonaktif',
  },
];

export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1',
    orderNumber: 'PO-2026-0731',
    supplierName: 'PT Sumber Makmur Sejahtera',
    itemCount: 12,
    totalAmount: 45200000,
    orderDate: '2026-07-31',
    expectedDate: '2026-08-06',
    status: 'diproses',
  },
  {
    id: 'po-2',
    orderNumber: 'PO-2026-0728',
    supplierName: 'CV Karya Distribusi Nusantara',
    itemCount: 6,
    totalAmount: 12850000,
    orderDate: '2026-07-28',
    expectedDate: '2026-08-02',
    status: 'dikirim',
  },
  {
    id: 'po-3',
    orderNumber: 'PO-2026-0720',
    supplierName: 'UD Berkah Logistik',
    itemCount: 20,
    totalAmount: 78900000,
    orderDate: '2026-07-20',
    expectedDate: '2026-07-27',
    status: 'selesai',
  },
];

export const SEED_DELIVERIES: Delivery[] = [
  {
    id: 'dlv-1',
    code: 'DLV-88213',
    origin: 'Gudang Bandung Timur',
    destination: 'Toko Sumber Rejeki, Antapani',
    courierName: 'Yusuf Maulana',
    distanceKm: 8.2,
    status: 'perjalanan',
    scheduledAt: '2026-08-05T09:00:00',
    latitude: -6.9147,
    longitude: 107.6685,
  },
  {
    id: 'dlv-2',
    code: 'DLV-88190',
    origin: 'Gudang Bandung Barat',
    destination: 'Minimarket Sejahtera, Cihampelas',
    courierName: 'Dedi Kurniawan',
    distanceKm: 3.4,
    status: 'menunggu',
    scheduledAt: '2026-08-05T13:30:00',
  },
  {
    id: 'dlv-3',
    code: 'DLV-88104',
    origin: 'Gudang Bandung Timur',
    destination: 'Warung Bu Yanti, Buahbatu',
    courierName: 'Yusuf Maulana',
    distanceKm: 5.7,
    status: 'terkirim',
    scheduledAt: '2026-08-04T10:15:00',
  },
];

export const SEED_INVENTORY: InventoryRecord[] = [
  {
    id: 'inv-1',
    itemName: 'Beras Premium 5kg',
    sku: 'BRG-0021',
    warehouseName: 'Gudang Bandung Timur',
    quantity: 320,
    unit: 'Karung',
    lastOpname: '2026-07-30',
    variance: 0,
    status: 'sesuai',
  },
  {
    id: 'inv-2',
    itemName: 'Minyak Goreng 2L',
    sku: 'BRG-0044',
    warehouseName: 'Gudang Bandung Timur',
    quantity: 48,
    unit: 'Botol',
    lastOpname: '2026-07-30',
    variance: -4,
    status: 'selisih',
  },
  {
    id: 'inv-3',
    itemName: 'Kardus Packing Sedang',
    sku: 'BRG-0158',
    warehouseName: 'Gudang Bandung Barat',
    quantity: 1520,
    unit: 'Pcs',
    lastOpname: '2026-07-29',
    variance: 0,
    status: 'sesuai',
  },
];

export const SEED_TASKS: Task[] = [
  {
    id: 'tsk-1',
    title: 'Stok opname Gudang Bandung Timur',
    assignee: 'Rizky Ardiansyah',
    dueDate: '2026-08-06',
    priority: 'tinggi',
    status: 'proses',
  },
  {
    id: 'tsk-2',
    title: 'Verifikasi Purchase Order PO-2026-0731',
    assignee: 'Dewi Lestari',
    dueDate: '2026-08-05',
    priority: 'sedang',
    status: 'baru',
  },
  {
    id: 'tsk-3',
    title: 'Follow up retur DLV-88104',
    assignee: 'Fajar Nugraha',
    dueDate: '2026-08-03',
    priority: 'tinggi',
    status: 'terlambat',
  },
];

export const SEED_USERS: ManagedUser[] = [
  {
    id: 'usr-1',
    name: 'Zahra Putri',
    username: 'zahra.putri',
    email: 'zahra@stockrsd.id',
    role: 'super_admin',
    status: 'aktif',
    lastLogin: '2026-08-05T08:12:00',
  },
  {
    id: 'usr-2',
    name: 'Rizky Ardiansyah',
    username: 'rizky.a',
    email: 'rizky@stockrsd.id',
    role: 'admin',
    status: 'aktif',
    lastLogin: '2026-08-04T17:40:00',
  },
  {
    id: 'usr-3',
    name: 'Dewi Lestari',
    username: 'dewi.l',
    email: 'dewi@stockrsd.id',
    role: 'karyawan',
    status: 'aktif',
    lastLogin: '2026-08-05T07:55:00',
  },
];

export function buildReportRows(prefix: string, count = 6): ReportRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    date: `2026-07-${String(24 + index).padStart(2, '0')}`,
    reference: `${prefix.toUpperCase()}-${1000 + index}`,
    warehouseName: SEED_WAREHOUSES[index % SEED_WAREHOUSES.length]?.name ?? '-',
    itemName: SEED_ITEMS[index % SEED_ITEMS.length]?.name ?? '-',
    quantity: 20 + index * 7,
    value: (20 + index * 7) * 25000,
    status: index % 3 === 0 ? 'Selesai' : 'Diproses',
  }));
}

export const SEED_DASHBOARD_STATS: StatMetric[] = [
  { id: 'total-barang', label: 'Total Barang', value: '2,000' },
  { id: 'barang-masuk', label: 'Barang Masuk', value: '20,000' },
  { id: 'barang-keluar', label: 'Barang Keluar', value: '10,000' },
  { id: 'akurasi', label: 'Akurasi Inventaris', value: '80%' },
];

export const SEED_TREND_IN_OUT: TrendPoint[] = [
  { label: 'Mar', value: 320, secondaryValue: 260 },
  { label: 'Apr', value: 280, secondaryValue: 310 },
  { label: 'Mei', value: 350, secondaryValue: 300 },
  { label: 'Jun', value: 300, secondaryValue: 340 },
  { label: 'Jul', value: 420, secondaryValue: 360 },
  { label: 'Agu', value: 460, secondaryValue: 390 },
];

export const SEED_TRAFFIC: TrendPoint[] = [
  { label: 'Jan', value: 40 },
  { label: 'Feb', value: 55 },
  { label: 'Mar', value: 48 },
  { label: 'Apr', value: 62 },
  { label: 'Mei', value: 58 },
  { label: 'Jun', value: 70 },
  { label: 'Jul', value: 66 },
];

export const SEED_ACTIVITIES: ActivityItem[] = [
  { id: 'act-1', message: 'Zahra menambahkan Barang Masuk IN-2345', timeAgo: '5 menit lalu' },
  { id: 'act-2', message: 'Admin menyetujui PO-0100', timeAgo: '3 menit lalu' },
  { id: 'act-3', message: 'Zahra memproses Barang Keluar OUT-2908', timeAgo: '2 menit lalu' },
  { id: 'act-4', message: 'Admin menyetujui PO-0091', timeAgo: '20 menit lalu' },
];

export interface StockTransactionRow {
  id: string;
  date: string;
  code: string;
  type: 'Masuk' | 'Keluar';
  itemName: string;
  quantity: string;
  status: 'Selesai' | 'Proses';
}

export const SEED_TRANSACTIONS: StockTransactionRow[] = [
  {
    id: 'trx-1',
    date: '28-07-2026',
    code: 'IN-2345',
    type: 'Masuk',
    itemName: 'Router Mikrotik 750r2',
    quantity: '2 Unit',
    status: 'Selesai',
  },
  {
    id: 'trx-2',
    date: '28-07-2026',
    code: 'OUT-2345',
    type: 'Keluar',
    itemName: 'Switch',
    quantity: '2 Unit',
    status: 'Proses',
  },
  {
    id: 'trx-3',
    date: '10-06-2025',
    code: 'IN-123',
    type: 'Masuk',
    itemName: 'RJ45',
    quantity: '1 Pack',
    status: 'Selesai',
  },
  {
    id: 'trx-4',
    date: '29-01-2025',
    code: 'OUT-4278',
    type: 'Keluar',
    itemName: 'Router Tenda F3',
    quantity: '5 Unit',
    status: 'Proses',
  },
  {
    id: 'trx-5',
    date: '01-02-2024',
    code: 'IN-6789',
    type: 'Masuk',
    itemName: 'Kabel UTP Lan Cat5E',
    quantity: '3 Box',
    status: 'Proses',
  },
  {
    id: 'trx-6',
    date: '15-06-2025',
    code: 'OUT-287',
    type: 'Keluar',
    itemName: 'Fiber optik',
    quantity: '8 Unit',
    status: 'Proses',
  },
];
