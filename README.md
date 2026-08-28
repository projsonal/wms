# StokRSD WMS — Frontend

Frontend **Warehouse Management System (WMS)** untuk StokRSD. Dibangun
dengan **Next.js 16 (App Router + Turbopack) + TypeScript + React 19 +
Tailwind CSS v4**, terhubung ke backend Go
**[github.com/projsonal/gowms](https://github.com/projsonal/gowms)**.

> **Catatan soal dokumen ini:** bagian struktur folder & peta rute di bawah
> sebelumnya tidak sinkron dengan kode sungguhan (nama komponen yang tidak
> pernah ada, route group `(dashboard)` yang sudah diganti `(app)`, nama
> repo backend yang salah, dst) — sudah diperbarui supaya benar-benar
> mencerminkan struktur saat ini. Kalau menambah/menghapus halaman, tolong
> perbarui juga tabel di bawah supaya tidak berulang jadi tidak sinkron lagi.

## Menjalankan proyek

```bash
npm install
cp .env.example .env.local   # sesuaikan NEXT_PUBLIC_API_BASE_URL ke backend gowms Anda
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
│   └── (app)/                      route group: semua halaman terproteksi
│       ├── layout.tsx                 Sidebar + RoleGuard, dipakai bersama
│       ├── dashboard/page.tsx           pilih dashboard sesuai role
│       ├── kelola-barang/page.tsx         dst — satu folder per URL
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
│   ├── gudang/                         Kelola Barang, Unit Barang (SN), Manajemen
│   │                                     Gudang, Ringkasan Stok, Manajemen
│   │                                     Inventaris, Barang Masuk/Keluar/Rusak
│   ├── laporan/                            ReportPageTemplate (dipakai beberapa
│   │                                         halaman laporan lewat props, bukan
│   │                                         komponen terpisah per jenis laporan)
│   └── content/                              modul lain: Manajemen User, Manajemen
│                                                Aset Gudang, Tracking Aset, Task
│                                                Management, Settings, Analisa Data
│
├── auth/                     STATE LOGIN & HAK AKSES (lintas halaman)
│   ├── AuthContext.tsx          siapa yang sedang login (React Context)
│   ├── roles.ts                   menu sidebar & pembatasan akses per role
│   └── demo.ts                      mode pratinjau tanpa backend
│
├── lib/                      LOGIC NON-KOMPONEN
│   ├── api/                    komunikasi ke backend gowms
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
  modul spesifik (gudang/laporan/content)?"
- Route group `(app)` adalah fitur resmi Next.js App Router untuk
  memakai satu `layout.tsx` (Sidebar + proteksi login) di banyak halaman
  tanpa menambah segmen di URL — bukan halaman sungguhan.

## Peta lengkap halaman -> komponen

Hanya rute yang benar-benar ditautkan di menu sidebar (lihat
`src/auth/roles.ts`) yang dicantumkan sebagai baris aktif. Beberapa URL lama
(`/warehouse`, `/items`, `/goods-in`, `/goods-out`, `/reports/goods-in`,
`/reports/goods-out`) masih hidup tapi HANYA sebagai redirect ke rute
kanoniknya — sengaja dipertahankan supaya bookmark/link lama tidak 404,
bukan halaman terpisah yang perlu disinkronkan kontennya.

| Route | Komponen | Folder |
|---|---|---|
| `/login` | `CaptchaGate` + `LoginWizard` (langkah-langkah di `component/auth`) | `app/login` |
| `/register` | `CaptchaGate` + `RegisterWizard` (berbagi langkah dengan login) | `app/register` |
| `/dashboard` | `SuperAdminDashboard` / `AdminDashboard` / `KaryawanDashboard` | `component/roles_dashboard` |
| `/kelola-barang` | `ItemsManagementContent` | `component/gudang` |
| `/unit-barang` | `BarangSerialContent` — cari/kelola unit fisik ber-nomor-seri (SN) | `component/gudang` |
| `/barang-masuk` | `BarangMasukContent` | `component/gudang` |
| `/barang-keluar` | `BarangKeluarContent` | `component/gudang` |
| `/barang-rusak` | `BarangRusakContent` | `component/gudang` |
| `/inventory` (Ringkasan Stok) | `InventoryOverviewContent` — agregat baca-saja | `component/gudang` |
| `/inventory-management` (Manajemen Inventaris) *(Staff)* | `InventoryManagementContent` — sesi Stock Opname | `component/gudang` |
| `/warehouse-management` (Manajemen Gudang) | `WarehouseListContent` | `component/gudang` |
| `/aset-gudang` (Manajemen Aset Gudang) | `AsetGudangContent` | `component/content` |
| `/tracking-aset` | `AssetTrackingMapContent` | `component/content` |
| `/data-analysis` *(Staff)* | — | `component/content` |
| `/user-management` *(Super Admin)* | — | `component/content` |
| `/settings` | `SettingsContent` | `component/content` |
| `/reports/inventory`, `/reports/barang-masuk`, `/reports/barang-keluar`, `/reports/returns`, `/reports/warehouse` *(Staff)* | `ReportPageTemplate` (via props) | `component/laporan` |
| `/reports/rekap-data` *(Staff)* | `RekapDataContent` | `component/laporan` |

### Modul backend yang ada tapi TIDAK aktif di frontend

Backend gowms punya controller/repo/model lengkap untuk **Purchase Order**,
**Supplier**, **Pengiriman** (pickup/dropoff, tracking, resi), dan **COD** —
tapi keempatnya sengaja **tidak ditautkan ke menu sidebar sama sekali** di
frontend saat ini (lihat komentar di `src/lib/api/modules.ts` dekat
`maintenanceApi`/`kategoriApi`: tipe & API call modul-modul ini "di-backup",
bukan dihapus permanen). Kalau salah satu mau diaktifkan lagi: perlu (1)
kembalikan tipe `Raw*`/API call yang sesuai di `lib/api`, (2) buat
komponen halamannya di `component/`, (3) daftarkan route-nya di `app/(app)/`,
(4) tambahkan link-nya di `NAV_GROUPS` (`src/auth/roles.ts`), dan (5)
tambahkan baris permission yang sesuai di `PERMISSION_MODULES`
(`src/lib/data/permission-modules.ts`) — kelimanya harus konsisten, bukan
cuma menyalakan salah satu.

## Integrasi Backend (`github.com/projsonal/gowms`)

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
| `resource.ts` | Factory CRUD generik dipakai modul non-auth (mis. Barang Masuk/Keluar) |
| `mappers.ts` | Konversi bentuk `Raw*` (persis field backend) <-> tipe UI di `@/types` |
| `modules.ts` | Endpoint domain nyata (sudah diverifikasi ke source Go, lihat peta di komentar atas file itu sendiri): `/barang`, `/barang-serial`, `/barang-masuk`, `/barang-keluar`, `/barang-rusak`, `/gudang`, `/stock-opname`, `/aset`, `/laporan`, `/users`, `/roles`, `/dashboard/*`, dst |

Alur login lengkap ada di `src/app/login/page.tsx`, alur register di
`src/app/register/page.tsx`. Keduanya berbagi komponen langkah di
`src/component/auth/` (`CaptchaGate`, `CaptchaField`, `LoginStep`,
`RegisterStep`, `RoleSelectStep`, `TwoFactorSetupStep`, `OtpVerifyStep`,
`VerifyResultStep`).

### Menjalankan backend gowms untuk pengujian lokal

```bash
git clone https://github.com/projsonal/gowms.git
cd gowms
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
