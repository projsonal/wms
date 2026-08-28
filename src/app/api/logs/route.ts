import { NextResponse, type NextRequest } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const runtime = 'nodejs';

interface IncomingLogEntry {
  level?: 'info' | 'warn' | 'error';
  message?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: IncomingLogEntry;
  try {
    body = (await request.json()) as IncomingLogEntry;
  } catch {
    return NextResponse.json({ success: false, message: 'Body log tidak valid' }, { status: 400 });
  }

  const level = body.level === 'warn' || body.level === 'error' ? body.level : 'info';
  const entry = {
    level,
    message: body.message ?? '(tanpa pesan)',
    context: body.context,
    timestamp: body.timestamp ?? new Date().toISOString(),
    host: os.hostname(),
    source: 'client',
    ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
  };

  try {
    const logsDir = path.join(process.cwd(), 'log');
    await fs.mkdir(logsDir, { recursive: true });

    const line = `${JSON.stringify(entry)}\n`;
    await fs.appendFile(path.join(logsDir, 'app.log'), line, 'utf8');
    if (level === 'error') {
      await fs.appendFile(path.join(logsDir, 'errors.log'), line, 'utf8');
    }
  } catch (writeErr) {
    console.error('[api/logs] gagal menulis file log:', writeErr);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan log' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
