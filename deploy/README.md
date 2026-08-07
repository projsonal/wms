# Panduan Deploy & Integrasi Backend

## 1. Mode sekarang: localhost (development)

Frontend memanggil backend lewat `NEXT_PUBLIC_API_BASE_URL` di `.env.local`
(lihat `.env.example`). Default-nya:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/stockrsd
```

Ini berarti: jalankan backend Go (`go run ./cmd/main.go`, atau binary hasil
`go build`) di port 8080 pada mesin yang sama dengan `npm run dev`. Tidak
ada langkah tambahan — begini saja sudah "terintegrasi", asal dua proses
itu jalan bersamaan secara lokal.

## 2. Pindah ke REST API produksi (VPS, domain asli)

Cuma ganti **satu baris** — tidak perlu ubah kode apa pun, karena seluruh
pemanggilan API sudah lewat satu titik (`lib/api/client.ts` baca env ini):

```
# .env.production.local (JANGAN commit ke git — isi rahasia produksi)
NEXT_PUBLIC_API_BASE_URL=https://stokrsd.example.com/stockrsd
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

Kalau nginx (lihat bagian 4) mem-proxy frontend & backend di domain yang
SAMA seperti contoh di atas (path `/stockrsd/*` -> backend, sisanya ->
frontend), maka ini otomatis **same-origin** — CORS di backend tidak perlu
dikonfigurasi macam-macam lagi karena browser tidak menganggapnya
cross-origin. Kalau backend & frontend sengaja dipisah domain (mis.
`api.stokrsd.com` vs `app.stokrsd.com`), pastikan domain frontend
ditambahkan ke `CORS_ALLOWED_ORIGINS` di `.env` backend
(`internal/middleware/common_middleware.go` baca daftar ini).

## 3. Kenapa data masih kosong walau sudah connect?

DB Postgres kamu memang masih kosong (kecuali tabel user) — itu **bukan
bug**. Setelah integrasi ini, tiap halaman modul memanggil endpoint asli
(`/barang`, `/gudang`, `/supplier`, dst.) dan akan menampilkan array kosong
apa adanya begitu backend berhasil merespons — bukan lagi data contoh.
Untuk mengisi data uji coba, backend sudah sediakan:

```
go run ./cmd/seed/main.go
```

(lihat `cmd/seed/main.go` di repo backend.)

## 4. Setup VPS tanpa Docker (nginx + systemd + GitHub Actions)

File-file berikut sudah disiapkan di folder `deploy/` (frontend, repo ini)
dan `deploy/`, `workflows/` (backend, di repo gowms):

| File | Fungsi |
|---|---|
| `deploy/systemd/gowms-frontend.service` | Jalankan `next start` sebagai service, auto-restart |
| `deploy/nginx/stokrsd.conf` | Reverse proxy: `/` -> frontend:3000, `/stockrsd/*` -> backend:8080 |
| `deploy/workflows/frontend-deploy.yml` | GitHub Actions: build -> SSH -> restart systemd |

Backend sudah punya padanannya (`gowms-backend.service`,
`workflows/backend-deploy.yml`) — pola sama persis di kedua repo.

**Langkah setup VPS (sekali saja):**

```bash
# 1. Buat user & folder kerja
sudo useradd -r -s /bin/false gowms
sudo mkdir -p /opt/gowms/frontend /opt/gowms/backend /var/log/gowms
sudo chown -R gowms:gowms /opt/gowms /var/log/gowms

# 2. Install Node, nginx, certbot (tanpa Docker)
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx

# 3. Pasang unit systemd
sudo cp deploy/systemd/gowms-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gowms-frontend gowms-backend

# 4. Pasang config nginx
sudo cp deploy/nginx/stokrsd.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/stokrsd.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. HTTPS gratis (Let's Encrypt) - jalankan setelah domain resolve ke VPS
sudo certbot --nginx -d stokrsd.example.com

# 6. Isi .env.production.local & .env backend di /opt/gowms/{frontend,backend}/
#    lalu jalankan deploy pertama secara manual atau trigger workflow GitHub Actions.
```

Setelah setup awal ini selesai, deploy berikutnya otomatis tiap `git push`
ke branch `main` lewat GitHub Actions — tanpa perlu login VPS manual lagi.

## 5. Biaya

Setup ini (1 VPS kecil, nginx, systemd, tanpa Docker/registry/Kubernetes)
jauh lebih murah daripada setup berbasis container: tidak ada biaya image
registry, tidak perlu resource ekstra untuk container runtime, dan VPS
1 vCPU/1GB RAM sudah cukup untuk menjalankan Next.js + Fiber + Postgres
sekaligus pada skala kecil-menengah.
