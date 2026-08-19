'use client';

/**
 * Jaring pengaman TERAKHIR — dipakai Next.js hanya kalau root layout
 * (layout.tsx) sendiri yang gagal render, jadi harus mandiri (bawa
 * <html>/<body> sendiri, TIDAK bisa memakai komponen dari layout yang
 * justru sedang error). Sengaja dibuat sangat sederhana & tanpa
 * dependency ke StatusScreen/Tailwind config supaya tetap bisa tampil
 * walau ada yang salah total di level fondasi aplikasi.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }): React.JSX.Element {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
          background: '#faf7f2',
          color: '#1c2521',
        }}
      >
        <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.2em', color: '#a13c34' }}>
          KODE 500
        </span>
        <h1 style={{ fontSize: 24, margin: 0 }}>Aplikasi Gagal Dimuat</h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: '#5b5b52' }}>
          Terjadi kesalahan mendasar saat memuat aplikasi. Coba muat ulang halaman ini.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '10px 22px',
            background: '#b3471f',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Muat Ulang
        </button>
      </body>
    </html>
  );
}
