import QRCode from 'qrcode';

const APP_ISSUER = 'WMS-RSD';

/**
 * Membentuk URI `otpauth://totp/...` standar yang dipahami semua aplikasi
 * Authenticator (Google Authenticator, Authy, dst.), dari secret TOTP yang
 * backend berikan + label akun (biasanya username).
 *
 * Format resmi: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */
export function buildTotpUri(secret: string, accountLabel: string): string {
  const label = encodeURIComponent(`${APP_ISSUER}:${accountLabel}`);
  const issuer = encodeURIComponent(APP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate kode QR PNG (data URL) LANGSUNG DI BROWSER dari secret TOTP —
 * tidak bergantung sama sekali pada gambar QR dari backend, supaya selalu
 * tampil meski endpoint gambar backend bermasalah/kosong. Backend cukup
 * mengirim `secret` mentahnya (yang memang sudah dikirim untuk opsi entri
 * manual), sisanya digenerate di sini.
 */
export async function generateTotpQrDataUrl(secret: string, accountLabel: string): Promise<string> {
  const uri = buildTotpUri(secret, accountLabel);
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 1,
    color: { dark: '#2b211d', light: '#ffffff' },
  });
}
