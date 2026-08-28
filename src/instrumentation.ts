export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

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
