import { apiClient, setBotToken } from '@/lib/api/client';
import type { BotCheckResponse, CaptchaChallenge } from '@/types';

/**
 * Endpoint gerbang anti-bot backend gostock (internal/controller/security).
 * Hampir seluruh route lain (termasuk /auth/*) mewajibkan header X-Bot-Token
 * yang valid — kalau belum ada/kedaluwarsa, alurnya:
 *   1. verify()  -> kalau belum lolos, backend balikin soal captcha gambar
 *   2. tampilkan captcha ke user, minta jawabannya
 *   3. solve()   -> kirim jawaban, backend balikin bot_token kalau benar
 * bot_token itu lalu otomatis disisipkan `apiClient` ke semua request lain
 * (lihat lib/api/client.ts) dan terus diperbarui di setiap respons.
 */
export const securityApi = {
  verify: () =>
    apiClient.post<BotCheckResponse>(
      '/security/verify',
      {},
      { skipAuth: true, skipBotToken: true },
    ),

  solve: (challenge: { captchaToken: string; captchaAnswer: string }) =>
    apiClient
      .post<BotCheckResponse>('/security/challenge', challenge, {
        skipAuth: true,
        skipBotToken: true,
      })
      .then((res) => {
        if (res.botToken) {
          setBotToken(res.botToken);
        }
        return res;
      }),
};

/** GET /captcha — soal captcha terpisah yang dipakai khusus di form /register. */
export const captchaApi = {
  generate: () => apiClient.get<CaptchaChallenge>('/captcha'),
};
