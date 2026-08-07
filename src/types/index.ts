/**
 * Kumpulan tipe domain untuk aplikasi StokRSD WMS.
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
  errors?: FieldError[] | unknown;
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
  email: string;
  password: string;
  passwordConfirmation: string;
  fullName: string;
  phoneNumber?: string;
  roleName?: UserRole;
  captchaToken: string;
  captchaAnswer: string;
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

export type OtpMethod = 'totp' | 'whatsapp';

export interface RequestOtpResponse {
  otpToken: string;
  expiresInSeconds: number;
}

/** Metode pengiriman kode reset password. */
export type PasswordResetMethod = 'whatsapp' | 'sms';

export interface RequestPasswordResetPayload {
  /** Username atau email akun yang lupa passwordnya. */
  identifier: string;
  method: PasswordResetMethod;
}

export interface RequestPasswordResetResponse {
  /** Token sesi reset — dibawa terus sampai password baru berhasil disimpan. */
  resetToken: string;
  expiresInSeconds: number;
}

export interface VerifyPasswordResetOtpPayload {
  resetToken: string;
  otpCode: string;
}

export interface ResetPasswordPayload {
  resetToken: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

/** Tantangan CAPTCHA gambar self-hosted (pkg/captcha). Dipakai untuk /register
 * maupun gerbang anti-bot /security/*. */
export interface CaptchaChallenge {
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
  unit: string;
  stock: number;
  minStock: number;
  price: number;
  warehouseId: string;
  warehouseName: string;
  status: 'tersedia' | 'menipis' | 'habis';
  updatedAt: string;
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
  status: 'aktif' | 'nonaktif';
  latitude?: number;
  longitude?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  totalOrders: number;
  rating: number;
  status: 'aktif' | 'nonaktif';
}

export type PurchaseOrderStatus = 'draft' | 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierName: string;
  itemCount: number;
  totalAmount: number;
  orderDate: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
}

export type DeliveryStatus = 'menunggu' | 'dijemput' | 'perjalanan' | 'terkirim' | 'gagal';

export interface Delivery {
  id: string;
  code: string;
  origin: string;
  destination: string;
  courierName: string;
  distanceKm: number;
  status: DeliveryStatus;
  scheduledAt: string;
  latitude?: number;
  longitude?: number;
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

export type TaskStatus = 'baru' | 'proses' | 'selesai' | 'terlambat';
export type TaskPriority = 'rendah' | 'sedang' | 'tinggi';

export interface Task {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

export interface ManagedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'aktif' | 'nonaktif';
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
