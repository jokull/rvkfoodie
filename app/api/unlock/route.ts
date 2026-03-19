import { env } from "cloudflare:workers";
import {
  getSessionData,
  setSessionData,
  sessionCookieHeader,
} from "@/lib/session";

/**
 * Called when a customer returns from Gumroad after purchase.
 * Looks up their unlock token in KV, unlocks the guide in their session.
 */
export async function GET(request: Request) {
  const kv = env.PURCHASES as KVNamespace;
  const url = new URL(request.url);

  const token = url.searchParams.get("token");
  const fallbackSlug = url.searchParams.get("slug") ?? "food-guide";

  if (!token) {
    return Response.redirect(new URL(`/guides/${fallbackSlug}`, url.origin));
  }

  // Look up purchase by unlock token
  const raw = await kv.get(`unlock:${token}`);
  if (!raw) {
    // Token not found — Ping may not have arrived yet, or token expired.
    return Response.redirect(
      new URL(`/guides/${fallbackSlug}?pending=true`, url.origin),
    );
  }

  const purchase = JSON.parse(raw) as {
    productIds: string[];
    slug: string;
  };

  // Unlock all products from this purchase
  const unlocked: string[] =
    (await getSessionData<string[]>("unlockedProducts")) ?? [];
  for (const pid of purchase.productIds) {
    if (!unlocked.includes(pid)) {
      unlocked.push(pid);
    }
  }
  const { sessionId, isNew } = await setSessionData(
    "unlockedProducts",
    unlocked,
  );

  // Clean up the token (one-time use)
  await kv.delete(`unlock:${token}`);

  const headers = new Headers({
    Location: new URL(`/guides/${purchase.slug}`, url.origin).toString(),
  });
  if (isNew) {
    headers.set("Set-Cookie", sessionCookieHeader(sessionId));
  }

  return new Response(null, { status: 302, headers });
}
