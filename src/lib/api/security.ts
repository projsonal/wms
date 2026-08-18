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

/** GET /captcha — soal captcha terpisah yang dipakai khusus di form /register
 * (lihat catatan RegisterRequest backend — form Register TETAP pakai captcha
 * gambar, cuma Lupa Password & Ubah Kata Sandi yang beralih ke humancheck,
 * lihat humanCheckApi di bawah). skipBotToken: true karena endpoint ini
 * sendiri yang membuat soal captcha (bukan yang butuh diverifikasi), dan
 * supaya error asli dari endpoint ini (mis. captcha gagal dibuat di server)
 * tidak salah tertangkap sebagai "perlu bot-check lagi" oleh apiClient. */
export const captchaApi = {
  generate: () => apiClient.get<CaptchaChallenge>('/captcha', { skipBotToken: true }),
};

/** GET /human-check — token verifikasi "verify you are human" ala Cloudflare
 * Turnstile (lihat pkg/humancheck backend), dipakai form Lupa Password &
 * Ubah Kata Sandi (lihat HumanCheckField.tsx) sebagai pengganti captcha
 * gambar. Token harus di-issue lebih dulu, lalu dikirim balik minimal
 * HUMANCHECK_MIN_DELAY_SECONDS setelah diterima (anti-submit-instan-bot),
 * dan cuma bisa dipakai sekali sebelum kedaluwarsa. skipBotToken: true
 * dengan alasan yang sama seperti captchaApi di atas. */
export const humanCheckApi = {
  issue: () => apiClient.get<{ humanCheckToken: string }>('/human-check', { skipBotToken: true }),
};
