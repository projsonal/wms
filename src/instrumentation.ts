export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Diimpor dinamis dari file terpisah (instrumentation.node.ts) supaya
  // bundler Edge Runtime tidak pernah menyertakan/menganalisis process.on
  // sama sekali — lihat komentar di instrumentation.node.ts.
  const { registerNodeHandlers } = await import('@/instrumentation.node');
  await registerNodeHandlers();
}
