import type { NextConfig } from "next";

// Alamat backend gostock DARI SUDUT PANDANG SERVER Next.js (proses `npm
// run dev` yang jalan di PC ini) — BUKAN dari sudut pandang browser.
// Karena backend gostock jalan di PC YANG SAMA dengan server Next.js ini,
// "localhost" di sini SELALU benar apa pun IP LAN PC saat ini (beda
// dengan NEXT_PUBLIC_API_BASE_URL yang dulu dipakai browser langsung —
// itu yang selalu rusak tiap IP PC berubah, terutama diakses dari HP).
// Override lewat env BACKEND_INTERNAL_URL kalau backend-nya sungguhan di
// mesin/port lain.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // WAJIB diisi manual tiap kali IP LAN PC berubah (cek `ipconfig`),
  // supaya perangkat lain (HP) di jaringan yang sama boleh membuka
  // http://<IP-PC>:3000 tanpa diblokir proteksi cross-origin dev server
  // Next.js. Ini beda urusan dari BACKEND_INTERNAL_URL di atas — yang
  // ini soal browser membuka HALAMANNYA, bukan soal API.
  allowedDevOrigins: ["10.11.12.173"],
  async rewrites() {
    return [
      {
        source: "/api/gowms/:path*",
        destination: `${BACKEND_INTERNAL_URL}/stockrsd/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_INTERNAL_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;