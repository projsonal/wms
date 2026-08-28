import QRCode from 'qrcode';

const APP_ISSUER = 'WMS-RSD';

export function buildTotpUri(secret: string, accountLabel: string): string {
  const label = encodeURIComponent(`${APP_ISSUER}:${accountLabel}`);
  const issuer = encodeURIComponent(APP_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export async function generateTotpQrDataUrl(secret: string, accountLabel: string): Promise<string> {
  const uri = buildTotpUri(secret, accountLabel);
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 1,
    color: { dark: '#2b211d', light: '#ffffff' },
  });
}
