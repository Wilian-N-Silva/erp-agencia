import { expect, type Page } from "@playwright/test";

// The suite shares an IP. Respect the real authentication throttle between users.
export async function signInWithRetry(page: Page, email: string, password: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: { email, password, rememberMe: true },
    });
    if (response.status() !== 429 || attempt === 2) {
      expect(response.ok(), `Authentication status: ${response.status()}`).toBe(true);
      return;
    }
    await page.waitForTimeout(retryDelay(response.headers()["retry-after"]));
  }
}

export function retryDelay(retryAfter: string | undefined) {
  const seconds = Number(retryAfter ?? 30);
  return (Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) + 1 : 31) * 1000;
}
