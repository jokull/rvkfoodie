import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const SESSION_COOKIE = "rvk_session";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

const kv = () => (env as unknown as { PURCHASES: KVNamespace }).PURCHASES;

export async function getSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getSessionData<T>(key: string): Promise<T | null> {
  const sessionId = await getSessionId();
  if (!sessionId) return null;
  const raw = await kv().get(`session:${sessionId}:${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setSessionData(
  key: string,
  value: unknown,
): Promise<{ sessionId: string; isNew: boolean }> {
  const existing = await getSessionId();
  const sessionId = existing ?? crypto.randomUUID();
  await kv().put(`session:${sessionId}:${key}`, JSON.stringify(value), {
    expirationTtl: SESSION_TTL,
  });
  return { sessionId, isNew: !existing };
}

export function sessionCookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_TTL}`;
}
