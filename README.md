# StokRSD WMS — Frontend

Frontend **Warehouse Management System (WMS)** untuk StokRSD. Dibangun
dengan **Next.js 16 (App Router + Turbopack) + TypeScript + React 19 +
Tailwind CSS v4**, terhubung ke backend Go
**[github.com/projsonal/gostock](https://github.com/projsonal/gostock)**.

## Menjalankan proyek

```bash
npm install
cp .env.example .env.local   # sesuaikan NEXT_PUBLIC_API_BASE_URL ke backend gostock Anda
npm run dev                  # http://localhost:3000
```

Skrip lain:

```bash
npm run build          # build produksi (Turbopack)
npm run start            # jalankan hasil build
npm run lint               # ESLint (flat config, termasuk aturan sonarjs)
npm run lint:fix             # ESLint dengan auto-fix
npm run type-check             # cek TypeScript tanpa emit
npm run format                   # Prettier write
npm run format:check               # Prettier check
npm run sonar                        # jalankan sonar-scanner (butuh server/token SonarQube)
```

## Struktur folder

```
src/
├── app/                      ROUTING SAJA (aturan Next.js App Router)
│   ├── layout.tsx              root layout + <AuthProvider>
│   ├── page.tsx                  redirect "/" -> "/login"
│   ├── login/page.tsx              wizard login (role -> kredensial -> 2FA)
│   └── (dashboard)/                route group: semua halaman terproteksi
│       ├── layout.tsx                 Sidebar + RoleGuard, dipakai bersama
│       ├── dashboard/page.tsx           pilih dashboard sesuai role
│       ├── items/page.tsx                 dst — satu folder per URL
│       └── ...                              (lihat daftar lengkap di bawah)
│
├── component/                COMPONENT, dikelompokkan per tanggung jawab
│   ├── ui/                     elemen dasar lintas halaman
│   │                             Button, Card, Badge, Modal, DataTable,
│   │                             FormControls, StatCard, StatsRow, MapPlaceholder
│   ├── layout/                  kerangka halaman
│   │                             Sidebar, Header, Footer, PageShell, RoleGuard
│   ├── charts/                    TrendChartCard, DonutChartCard, ProgressListCard
│   ├── auth/                       langkah-langkah wizard login & 2FA
│   ├── roles_dashboard/              isi dashboard per role
│   │                                   super_admin.tsx, admin.tsx, karyawan.tsx
│   │                                   (super_admin & admin berbagi logic lewat
│   │                                   StaffDashboardBase.tsx, tidak duplikasi)
│   ├── gudang/                         Kelola Barang, WMS, Manajemen Gudang,
│   │                                     Inventaris, Barang Masuk/Keluar
│   ├── pengiriman/                       Pickup & Dropoff, Monitoring
│   │                                       Pengiriman, Detail Lokasi, Cetak Resi
│   ├── laporan/                            ReportPageTemplate (dipakai 5 halaman
│   │                                         laporan lewat props, bukan 5 komponen
│   │                                         terpisah — supaya tidak duplikasi)
│   └── content/                              modul lain: Purchase Order, Supplier,
│                                                Manajemen User, Task Management,
│                                                Settings, Analisa Data
│
├── auth/                     STATE LOGIN & HAK AKSES (lintas halaman)
│   ├── AuthContext.tsx          siapa yang sedang login (React Context)
│   ├── roles.ts                   menu sidebar & pembatasan akses per role
│   └── demo.ts                      mode pratinjau tanpa backend
│
├── lib/                      LOGIC NON-KOMPONEN
│   ├── api/                    komunikasi ke backend gostock
│   ├── hooks/                    custom React hooks (mis. useResourceList)
│   ├── utils/                      fungsi murni (format tanggal/uang, status->badge)
│   └── data/                         data contoh (fallback sebelum backend aktif)
│
└── types/                    seluruh tipe TypeScript (Item, Warehouse, dst)
```

**Aturan yang dipegang:**
- `app/` **hanya** berisi `page.tsx`/`layout.tsx` (routing). Semua logic & JSX
  sesungguhnya ada di `component/`, supaya berpindah folder route tidak perlu
  menyentuh logic, dan sebaliknya.
- Satu folder = satu tanggung jawab. Kalau bingung taruh file baru di mana,
  tanya: "ini elemen dasar (ui), kerangka halaman (layout), atau konten
  modul spesifik (gudang/pengiriman/laporan/content)?"
- Route group `(dashboard)` adalah fitur resmi Next.js App Router untuk
  memakai satu `layout.tsx` (Sidebar + proteksi login) di banyak halaman
  tanpa menambah segmen di URL — bukan halaman sungguhan.

## Peta lengkap halaman -> komponen

| Route | Komponen | Folder |
|---|---|---|
| `/login` | `CaptchaGate` + `LoginWizard` (langkah-langkah di `component/auth`) | `app/login` |
| `/register` | `CaptchaGate` + `RegisterWizard` (berbagi langkah dengan login) | `app/register` |
| `/dashboard` | `SuperAdminDashboard` / `AdminDashboard` / `KaryawanDashboard` | `component/roles_dashboard` |
| `/pickup-dropoff` | `PickupDropoffContent` | `component/pengiriman` |
| `/delivery-monitoring` | `DeliveryMonitoringContent` | `component/pengiriman` |
| `/delivery/[id]` | `DeliveryDetailContent` | `component/pengiriman` |
| `/receipt/[id]` | `ReceiptContent` | `component/pengiriman` |
| `/cod-monitoring` | `CodMonitoringContent` | `component/content` |
| `/items` (Kelola Barang) | `ItemsManagementContent` | `component/gudang` |
| `/warehouse` (WMS) | `WarehouseListContent` | `component/gudang` |
| `/warehouse-management` | `WarehouseManagementContent` | `component/gudang` |
| `/inventory` | `InventoryOverviewContent` | `component/gudang` |
| `/inventory-management` | `InventoryManagementContent` | `component/gudang` |
| `/goods-in`, `/goods-out` | `GoodsInContent`, `GoodsOutContent` | `component/gudang` |
| `/purchase-order` | `PurchaseOrderContent` | `component/content` |
| `/supplier` | `SupplierContent` | `component/content` |
| `/data-analysis` | `DataAnalysisContent` | `component/content` |
| `/user-management` *(Super Admin)* | `UserManagementContent` | `component/content` |
| `/tasks` *(Super Admin)* | `TaskManagementContent` | `component/content` |
| `/settings` | `SettingsContent` | `component/content` |
| `/reports/*` (5 halaman) | `ReportPageTemplate` (via props) | `component/laporan` |

## Integrasi Backend (`github.com/projsonal/gostock`)

Modul autentikasi frontend ini ditulis dengan membaca langsung source code
backend (`internal/controller/auth`, `internal/controller/security`,
`internal/controller/users`, `internal/routes/router.go`) — bukan tebakan.
Beberapa hal penting yang perlu diketahui:

- **Base URL berprefix `/stockrsd`**, bukan `/api/v1` — lihat `.env.example`.
- **Semua response dibungkus Envelope** `{ success, message, data, meta, errors }`
  (`pkg/utils/response.go`). `src/lib/api/client.ts` otomatis membongkarnya
  jadi `data` langsung, jadi kode pemanggil endpoint tidak perlu peduli.
- **JSON dari Go pakai snake_case** (`access_token`, `role_name`, dst).
  `src/lib/utils/casing.ts` mengonversi otomatis ke/dari camelCase di satu
  titik (`client.ts`), supaya kode TypeScript tetap pakai konvensi wajar.
- **Gerbang anti-bot wajib** di depan hampir semua endpoint (termasuk
  `/auth/*`): header `X-Bot-Token` yang didapat lewat captcha di
  `POST /security/verify` → `/security/challenge`, dan **dirotasi server di
  setiap respons**. `component/auth/CaptchaGate.tsx` menangani ini secara
  otomatis di depan halaman `/login` & `/register` — kalau butuh menambah
  halaman publik baru (di luar dashboard), bungkus juga dengan `<CaptchaGate>`.
- **Role TIDAK dipilih saat login.** Role melekat ke akun sejak registrasi
  (di production API selalu dipaksa jadi `karyawan`; role lain hanya bisa
  diberikan Super Admin lewat Manajemen User). Layar "Pilih Role Kamu" pada
  desain aslinya adalah bagian dari alur **register** (dan hanya berlaku di
  lingkungan non-production backend), bukan login.
- **Token sesi baru terbit setelah 2FA/OTP selesai**, bukan langsung dari
  `POST /auth/login`. Login hanya memberi `pending_token` (jembatan
  sementara) + flag `require_setup_2fa` **atau** `require_otp`.

Semua komunikasi ke backend ada di `src/lib/api/`:

| File | Isi |
|---|---|
| `client.ts` | Wrapper `fetch`: bongkar Envelope, konversi casing, sisip `Authorization: Bearer`, sisip & rotasi `X-Bot-Token`, lempar `BotCheckRequiredError` saat status 428 |
| `security.ts` | `POST /security/verify`, `/security/challenge` (gerbang anti-bot) + `GET /captcha` (captcha form register) |
| `auth.ts` | `register`, `login`, `setupTwoFactor`, `confirmTwoFactorSetup`, `requestOtp` (WhatsApp), `verifyOtp`, `refresh`, `logout`, `me`, `listSessions`, `revokeSession` — 1:1 dengan `auth_controller.go` |
| `account.ts` | `PATCH /users/me/password/request-otp` + `/confirm` — ganti password (perlu verifikasi OTP WhatsApp) |
| `resource.ts` | Factory CRUD generik dipakai modul non-auth (items, warehouses, dst) |
| `modules.ts` | Endpoint domain: `items`, `warehouses`, `suppliers`, `purchase-orders`, `deliveries`, `inventory`, `tasks`, `users`, `dashboard/summary` — **belum diverifikasi ke source Go**, sesuaikan bila field/path berbeda |
| `reports.ts` | `GET /reports/:type` untuk 5 jenis laporan — **belum diverifikasi ke source Go** |

Alur login lengkap ada di `src/app/login/page.tsx`, alur register di
`src/app/register/page.tsx`. Keduanya berbagi komponen langkah di
`src/component/auth/` (`CaptchaGate`, `CaptchaField`, `LoginStep`,
`RegisterStep`, `RoleSelectStep`, `TwoFactorSetupStep`, `OtpVerifyStep`,
`VerifyResultStep`).

### Menjalankan backend gostock untuk pengujian lokal

```bash
git clone https://github.com/projsonal/gostock.git
cd gostock
cp .env.example .env   # kalau ada; kalau tidak, isi minimal APP_PORT, DB_*, JWT_*
go run cmd/main.go     # default listen di :8080
```

Default `CORS_ALLOWED_ORIGINS` backend sudah mengizinkan `http://localhost:3000`
(default `npm run dev`), jadi tidak perlu konfigurasi tambahan untuk
development lokal.

### Mode Pratinjau (tanpa backend)

Halaman login menyediakan tautan **"Backend belum terhubung? Lanjutkan
dalam mode pratinjau"** yang menyimpan user tiruan di `localStorage`
supaya seluruh halaman dashboard tetap bisa dieksplorasi walau backend
belum aktif. Ini melewati seluruh alur di atas (bot-check, 2FA, dst) —
murni untuk meninjau UI. Nonaktifkan dengan `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`
di `.env.local` untuk build produksi/staging yang sudah terhubung ke backend asli.

## Role & Hak Akses

Tiga role: **Super Admin**, **Admin**, **Karyawan**. Konfigurasi menu &
akses per role ada di `src/auth/roles.ts`. Modul **Manajemen User** dan
**Task Manajemen** dibatasi khusus **Super Admin** — secara fungsional
user biasa/karyawan tidak selayaknya mengelola akun pengguna lain atau
menugaskan lintas tim.

## Kualitas Kode / SonarQube

- `sonar-project.properties` siap pakai (`sonar.sources=src`)
- `eslint.config.mjs` (flat config ESLint 9) mengaktifkan
  `eslint-plugin-sonarjs`: `cognitive-complexity`, `no-duplicate-string`,
  `no-identical-functions`, `no-nested-conditional`, dll — sudah dites
  bersih (`npm run lint` = 0 error, 0 warning)
- Pola berulang diekstrak jadi satu titik reuse, bukan disalin-tempel di
  tiap halaman: `createResourceApi` (CRUD), `DataTable`, `ReportPageTemplate`
  (5 halaman laporan berbagi 1 komponen), `StaffDashboardBase` (Admin &
  Super Admin berbagi 1 komponen dashboard)
- Jalankan `npm run sonar` setelah mengatur `sonar.host.url` & token
  sesuai instance SonarQube Anda

## Catatan Implementasi

- Tailwind v4 memakai pendekatan **CSS-first** — semua token warna/radius
  ada di `@theme` pada `src/app/globals.css`, tidak ada `tailwind.config.js`
  terpisah lagi.
- `MapPlaceholder` memakai grid CSS ringan tanpa API key pihak ketiga —
  pada integrasi produksi, ganti dengan komponen peta nyata (Google
  Maps/Mapbox) memakai field `latitude`/`longitude` pada tipe
  `Delivery`/`Warehouse`.
- `src/lib/data/sample-data.ts` hanya dipakai sebagai `fallbackData` SWR —
  begitu backend merespons, data asli otomatis menggantikannya.
- Logo (`public/assets/stockrsdLogo.png`) & favicon (`src/app/icon.png`)
  sudah terpasang di halaman login dan sidebar.
