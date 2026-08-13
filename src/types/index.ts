/**
 * Kumpulan tipe domain untuk aplikasi WMS-RSD.
 * Struktur mengikuti kontrak REST API backend github.com/projsonal/gostock
 * (lihat internal/controller/auth/struct.go pada repo backend untuk acuan asli).
 */

export type UserRole = 'super_admin' | 'admin' | 'karyawan';

/** Envelope respons baku seluruh endpoint gostock (pkg/utils/response.go). */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: unknown;
  errors?: FieldError[] | Record<string, unknown>;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  roleId: number;
  role: UserRole;
  twoFactorEnabled: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  passwordConfirmation: string;
  fullName: string;
  phoneNumber?: string;
  roleName?: UserRole;
  /** Opsional — aplikasi internal, captcha tidak lagi ditampilkan di UI
   * (lihat AuthTabs/register/page.tsx). Field dipertahankan di tipe ini
   * (bukan dihapus total) supaya backend tetap bisa memverifikasinya
   * kalau suatu saat diaktifkan lagi tanpa breaking change kontrak API. */
  captchaToken?: string;
  captchaAnswer?: string;
}

export interface SessionInfo {
  id?: number;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: string;
  ipAddress: string;
  location: string;
  createdAt?: string;
  /** true kalau ini sesi yang sedang dipakai browser ini sendiri. */
  isCurrent?: boolean;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  roleId: number;
  roleName: UserRole;
}

/** Respons bersama untuk /auth/login, /register, /2fa/confirm, /verify-otp, /refresh. */
export interface AuthFlowResponse {
  requirePhoneVerification?: boolean;
  requireSetup2fa: boolean;
  requireOtp: boolean;
  pendingToken?: string;
  tokenType?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: UserSummary;
  session?: SessionInfo;
}

export interface Setup2FAResponse {
  secret: string;
  /** Data URI PNG ("data:image/png;base64,...") — langsung dipakai di <img src>. */
  qrCodePngBase64: string;
}

/** Tantangan CAPTCHA gambar self-hosted (pkg/captcha). Dipakai untuk /register
 * maupun gerbang anti-bot /security/*. */
export interface CaptchaChallenge {
  imageBase64: string | Blob | undefined;
  captchaToken: string;
  /** Data URI PNG ("data:image/png;base64,..."). */
  captchaImageBase64: string;
}

export interface BotCheckResponse {
  passed: boolean;
  botToken?: string;
  captcha?: CaptchaChallenge;
}

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatMetric {
  id: string;
  label: string;
  value: string | number;
  helperText?: string;
  variant?: StatusBadgeVariant;
}

export interface TrendPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  categoryId?: string;
  unit: string;
  unitId?: string;
  stock: number;
  minStock: number;
  price: number;
  /** Berat satuan dalam gram, opsional — dipakai di resi pengiriman. */
  weightGram?: number;
  warehouseId: string;
  warehouseName: string;
  status: 'tersedia' | 'menipis' | 'habis';
  updatedAt: string;
  deskripsi?: string;
  /** Dikunci (Protect) oleh super_admin — field sensitif disamarkan untuk karyawan. */
  isProtected?: boolean;
  /** Alur persetujuan khusus barang yang dibuat role admin. */
  approvalStatus?: 'disetujui' | 'menunggu' | 'ditolak';
  catatanApproval?: string;
  /** ID user yang mengajukan (kalau approvalStatus bukan 'disetujui') —
   * dipakai mencegah user meng-approve/reject pengajuannya sendiri. */
  submittedByUserId?: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  capacity: number;
  usedCapacity: number;
  totalItems: number;
  picName: string;
  /** Nomor kontak gudang — "No. Telepon Pengirim" di resi pengiriman. */
  phone?: string;
  status: 'aktif' | 'nonaktif';
  latitude?: number;
  longitude?: number;
  isProtected?: boolean;
}

export interface Supplier {
  id: string;
  code?: string;
  name: string;
  contactPerson: string;
  phone: string;
  /** Daftar nama kurir mitra (mis. ["JNE", "J&T", "Lalamove"]) — menggantikan
   * field email lama. Dipakai backend menghitung totalOrders/rating dari
   * data Pengiriman yang memakai kurir-kurir ini. */
  courierPartners: string[];
  address: string;
  npwp?: string;
  notes?: string;
  totalOrders: number;
  rating: number;
  status: 'aktif' | 'nonaktif';
  isProtected?: boolean;
}

export type PurchaseOrderStatus = 'draft' | 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId?: string;
  supplierName: string;
  itemCount: number;
  totalAmount: number;
  orderDate: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  /** Status ASLI dari backend (draft/diajukan/disetujui/ditolak/dibatalkan)
   * — dipakai menentukan tombol alur kerja mana yang relevan (Ajukan/
   * Setujui/Tolak/Batalkan), karena `status` di atas sudah dipetakan ke
   * kosakata UI lama yang lebih sedikit (jadi ambigu untuk itu). */
  rawStatus?: string;
  isProtected?: boolean;
}

export type DeliveryStatus = 'menunggu' | 'dijemput' | 'perjalanan' | 'terkirim' | 'gagal';

export interface DeliveryItem {
  /** SKU dengan awalan "WRSD-" — lihat formatResiSku di Receipt.tsx untuk
   * konvensi tampilannya. */
  sku: string;
  name: string;
  qty: number;
  unit: string;
  /** Berat satuan (gram), kalau barang sudah diisi datanya. */
  weightGram?: number;
}

export interface Delivery {
  id: string;
  code: string;
  origin: string;
  /** ID gudang asal (bukan cuma nama) — dibutuhkan untuk prefill form Edit,
   * karena backend WAJIB mengirim ulang gudang_asal_id saat PUT /pengiriman/:id. */
  originGudangId?: number;
  originAddress?: string;
  originPhone?: string;
  /** Koordinat GUDANG ASAL (beda dengan latitude/longitude di bawah, yang
   * itu posisi GPS kurir live) — dipakai marker "Asal" di peta rute. */
  originLatitude?: number;
  originLongitude?: number;
  /** Nomor dokumen Barang Keluar yang mendasari pengiriman ini, kalau ada
   * — dipakai sebagai "Order ID" di resi (bukan ID numerik internal). */
  orderId?: string;
  items?: DeliveryItem[];
  /** Koordinat tujuan (opsional) — tanpa ini peta pelacakan tidak bisa
   * menggambar rute/marker tujuan. */
  destLatitude?: number;
  destLongitude?: number;
  destination: string;
  courierName: string;
  distanceKm: number;
  status: DeliveryStatus;
  /** pickup | dropoff (backend: jenis_pengambilan). */
  type: 'pickup' | 'dropoff';
  scheduledAt: string;
  /** Waktu benar-benar terkirim (diisi backend saat status jadi "terkirim") — undefined kalau belum. */
  deliveredAt?: string;
  latitude?: number;
  longitude?: number;
  receiverName?: string;
  receiverPhone?: string;
  courierPhone?: string;
  notes?: string;
  isProtected?: boolean;
}

export interface InventoryRecord {
  id: string;
  itemName: string;
  sku: string;
  warehouseName: string;
  quantity: number;
  unit: string;
  lastOpname: string;
  variance: number;
  status: 'sesuai' | 'selisih';
}

export type ReportType =
  | 'inventaris'
  | 'barang-masuk'
  | 'barang-keluar'
  | 'barang-retur'
  | 'gudang';

export interface ReportRow {
  id: string;
  date: string;
  reference: string;
  warehouseName: string;
  itemName: string;
  quantity: number;
  value: number;
  status: string;
}

export type JenisAset = 'tiang' | 'odc' | 'ont' | 'odp' | 'olt' | 'transportasi';
export type AssetStatus = 'aktif' | 'rusak' | 'nonaktif';

export interface Asset {
  id: string;
  nama: string;
  jenisAset: JenisAset;
  gudangId: string;
  gudangNama: string;
  /** Label RSD (tiang/odc/ont/odp/olt) — format {KodeGudang}-RSD-0001. */
  labelRsd?: string;
  /** Kode BA (transportasi) — format BA-0001. */
  kodeBa?: string;
  latitude?: number;
  longitude?: number;
  status: AssetStatus;
  keterangan?: string;
  createdAt: string;
  updatedAt: string;
}

export type BarangRusakStatus = 'pengecekan' | 'retur' | 'rusak';

export interface BarangRusak {
  id: string;
  barangId?: string;
  labelBarang: string;
  namaBarang: string;
  keterangan?: string;
  jenisBarang?: 'retur' | 'rusak' | '';
  status: BarangRusakStatus;
  dilaporkanOleh: string;
  pelapor?: string;
  dicekOleh?: string;
  pemeriksa?: string;
  dicekPada?: string;
  createdAt: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  /** Status akun (diaktifkan/dinonaktifkan admin) — beda dari isOnline. */
  status: 'aktif' | 'nonaktif';
  /** Status login REAL-TIME (punya sesi aktif sekarang). Dipakai kolom
   * "Status" di tabel Manajemen User sesuai permintaan: user yang tidak
   * sedang login tampil "Nonaktif", yang sedang login tampil "Aktif". */
  isOnline?: boolean;
  lastLogin?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}
