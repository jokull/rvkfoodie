import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import {
  getSessionData,
  setSessionData,
  SESSION_COOKIE,
  SESSION_TTL,
} from "@/lib/session";

/**
 * Called when a customer returns from Gumroad after purchase.
 * Looks up their unlock token in KV, unlocks the guide in their session.
 */
export async function GET(request: Request) {
  const kv = env.PURCHASES;
  const url = new URL(request.url);

  const token = url.searchParams.get("token");
  const fallbackSlug = url.searchParams.get("slug") ?? "food-guide";

  if (!token) {
    return Response.redirect(new URL(`/guides/${fallbackSlug}`, url.origin));
  }

  const raw = await kv.get(`unlock:${token}`);
  if (!raw) {
    return Response.redirect(
      new URL(`/guides/${fallbackSlug}?pending=true`, url.origin),
    );
  }

  const purchase = JSON.parse(raw) as {
    productIds: string[];
    slug: string;
  };

  const cookieStore = await cookies();
  const existingId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const unlocked: string[] = existingId
    ? ((await getSessionData<string[]>(existingId, "unlockedProducts")) ?? [])
    : [];
  for (const pid of purchase.productIds) {
    if (!unlocked.includes(pid)) {
      unlocked.push(pid);
    }
  }
  const sessionId = await setSessionData(
    existingId,
    "unlockedProducts",
    unlocked,
  );

  await kv.delete(`unlock:${token}`);

  if (!existingId) {
    cookieStore.set(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: SESSION_TTL,
    });
  }

  return Response.redirect(
    new URL(`/guides/${purchase.slug}`, url.origin).toString(),
  );
}
