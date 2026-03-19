import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "rvk_session";
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

export async function getSessionData<T>(
  sessionId: string,
  key: string,
): Promise<T | null> {
  const raw = await env.PURCHASES.get(`session:${sessionId}:${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setSessionData(
  sessionId: string | null,
  key: string,
  value: unknown,
): Promise<string> {
  const id = sessionId ?? crypto.randomUUID();
  await env.PURCHASES.put(`session:${id}:${key}`, JSON.stringify(value), {
    expirationTtl: SESSION_TTL,
  });
  return id;
}
