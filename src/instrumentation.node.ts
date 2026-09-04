// Kode khusus Node.js runtime (process.on dkk) diisolasi di file terpisah
// ini dan di-import secara dinamis dari instrumentation.ts HANYA saat
// NEXT_RUNTIME === 'nodejs'. Kalau kode ini ditulis langsung di
// instrumentation.ts, Turbopack/webpack tetap menganalisis file itu secara
// statis untuk build Edge Runtime juga (walau ada guard runtime di atas
// process.on-nya) dan memunculkan warning "A Node.js API is used ... not
// supported in the Edge Runtime" — meski secara fungsional aman (guard-nya
// mencegah eksekusi di Edge). Memisahkan ke file sendiri + dynamic import
// membuat bundler Edge tidak pernah menyertakan file ini sama sekali,
// sehingga warning-nya hilang di akarnya, bukan cuma diredam.
export async function registerNodeHandlers(): Promise<void> {
  const { logger } = await import('@/lib/logger');

  process.on('uncaughtException', (error) => {
    logger.error(error.message || 'Uncaught exception di server', {
      name: error.name,
      stack: error.stack,
    });
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error(message || 'Unhandled promise rejection di server', {
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
