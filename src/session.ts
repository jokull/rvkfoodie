/**
 * Consumer session — KV-backed, one cookie (`rvk_session`) separate from the
 * staff session (`rvk.session_token`). Holds the Gumroad-unlocked product
 * ids for this browser.
 */
import { env } from 'cloudflare:workers'

export const SESSION_COOKIE = 'rvk_session'
export const SESSION_TTL = 60 * 60 * 24 * 30 // 30 days

export const getSessionData = async <T>(sessionId: string, key: string): Promise<T | null> => {
  const raw = await env.PURCHASES.get(`session:${sessionId}:${key}`)
  return raw ? (JSON.parse(raw) as T) : null
}

export const setSessionData = async (
  sessionId: string | null,
  key: string,
  value: unknown,
): Promise<string> => {
  const id = sessionId ?? crypto.randomUUID()
  await env.PURCHASES.put(`session:${id}:${key}`, JSON.stringify(value), {
    expirationTtl: SESSION_TTL,
  })
  return id
}

export const sessionCookie = (id: string) =>
  `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}`

/** Read a cookie by name straight from a request header (API routes). */
export const readCookie = (request: Request, name: string): string | null => {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=').trim()
  }
  return null
}
