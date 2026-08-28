

export type UserRole = 'super_admin' | 'admin' | 'karyawan';

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
  avatarUrl?: string;
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

  isCurrent?: boolean;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  roleId: number;
  roleName: UserRole;
}

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

  qrCodePngBase64: string;
}

export interface CaptchaChallenge {
  imageBase64: string | Blob | undefined;
  captchaToken: string;

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

  weightGram?: number;
  warehouseId: string;
  warehouseName: string;
  status: 'tersedia' | 'menipis' | 'habis';
  createdAt: string;
  updatedAt: string;
  deskripsi?: string;

  isProtected?: boolean;

  isSerialized?: boolean;

  merek?: string;
  tipe?: string;

  approvalStatus?: 'disetujui' | 'menunggu' | 'ditolak';
  catatanApproval?: string;

  submittedByUserId?: number;

  delegatedToUserId?: number;
  delegatedToName?: string;
}

export interface BarangSerialUnit {
  id: string;
  barangId: string;
  barangNama?: string;

  barangMerek?: string;
  barangTipe?: string;
  serialNumber: string;
  status: 'tersedia' | 'terpasang' | 'rusak';
  warehouseId?: string;
  warehouseName?: string;
  catatan?: string;
  createdAt: string;
  updatedAt: string;

  nomorBarangMasuk?: string;
  nomorBarangKeluar?: string;
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

  phone?: string;
  status: 'aktif' | 'nonaktif';
  latitude?: number;
  longitude?: number;
  isProtected?: boolean;
}

export interface StokGudangRecord {
  id: string;
  barangId: string;
  sku: string;
  itemName: string;
  gudangId: string;
  warehouseName: string;
  quantity: number;
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

  labelRsd?: string;

  kodeBa?: string;
  latitude?: number;
  longitude?: number;
  status: AssetStatus;
  keterangan?: string;

  merek?: string;

  tipe?: string;

  parentAssetId?: string;

  jumlahPort?: number;

  portTerisi?: number;

  barangId?: string;
  kodeBarang?: string;
  createdAt: string;
  updatedAt: string;
}

export type BarangRusakStatus = 'pengecekan' | 'retur' | 'rusak';

export interface BarangRusak {
  id: string;
  barangId?: string;
  labelBarang: string;
  namaBarang: string;

  kodeBarang?: string;
  merek?: string;
  tipe?: string;

  serialNumber?: string;
  keterangan?: string;

  fotoUrl?: string;
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

  phoneNumber?: string;
  role: UserRole;

  status: 'aktif' | 'nonaktif';

  isOnline?: boolean;
  lastLogin?: string;
}

export interface UserDeviceSession {
  id: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: string;
  ipAddress?: string;
  location?: string;
  createdAt: string;
}

export type DeliveryStatus = 'menunggu' | 'dijemput' | 'perjalanan' | 'terkirim' | 'gagal';

export interface DeliveryItem {
  sku: string;
  name: string;
  qty: number;
  unit: string;
  weightGram?: number;
}

export interface Delivery {
  id: string;
  code: string;
  type: 'pickup' | 'dropoff';
  status: DeliveryStatus;

  origin: string;
  originAddress?: string;
  originPhone?: string;
  originGudangId?: number;
  originLatitude?: number;
  originLongitude?: number;

  destination: string;
  destLatitude?: number;
  destLongitude?: number;

  receiverName?: string;
  receiverPhone?: string;

  courierName: string;
  courierPhone?: string;

  scheduledAt: string;
  deliveredAt?: string;
  distanceKm: number;

  latitude?: number;
  longitude?: number;

  orderId?: string;
  notes?: string;
  isProtected?: boolean;

  items?: DeliveryItem[];
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
