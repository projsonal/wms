import { apiClient, setBotToken } from '@/lib/api/client';
import type { BotCheckResponse, CaptchaChallenge } from '@/types';

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

export const captchaApi = {
  generate: () => apiClient.get<CaptchaChallenge>('/captcha', { skipBotToken: true }),
};

export const humanCheckApi = {
  issue: () => apiClient.get<{ humanCheckToken: string }>('/human-check', { skipBotToken: true }),
};
