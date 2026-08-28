type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

const isServer = typeof window === 'undefined';

function buildEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };
}

async function writeServerLog(entry: LogEntry): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');

    const logsDir = path.join(process.cwd(), 'log');
    await fs.mkdir(logsDir, { recursive: true });

    const line = `${JSON.stringify({ ...entry, host: os.hostname() })}\n`;

    await fs.appendFile(path.join(logsDir, 'app.log'), line, 'utf8');
    if (entry.level === 'error') {
      await fs.appendFile(path.join(logsDir, 'errors.log'), line, 'utf8');
    }
  } catch (writeErr) {
    console.error('[logger] gagal menulis file log:', writeErr);
  }
}

function sendClientLog(entry: LogEntry): void {
  try {
    const payload = JSON.stringify(entry);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/logs', blob);
      return;
    }
    void fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Tidak ada fallback lain — kegagalan pengiriman log tidak boleh mengganggu aplikasi.
  }
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = buildEntry(level, message, context);

  let consoleMethod: typeof console.log;
  if (level === 'error') {
    consoleMethod = console.error;
  } else if (level === 'warn') {
    consoleMethod = console.warn;
  } else {
    consoleMethod = console.log;
  }
  consoleMethod(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, context ?? '');

  if (isServer) {
    void writeServerLog(entry);
  } else {
    sendClientLog(entry);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};

export type { LogEntry, LogLevel };
