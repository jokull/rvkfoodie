import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Called when a customer returns from Gumroad after purchase.
 * Looks up their unlock token in KV, unlocks the guide in their session.
 */
export const GET: APIRoute = async ({ url, session, redirect }) => {
  const kv = env.PURCHASES;

  const token = url.searchParams.get("token");
  const fallbackSlug = url.searchParams.get("slug") ?? "food-guide";

  if (!token) {
    return redirect(`/guides/${fallbackSlug}`);
  }

  // Look up purchase by unlock token
  const raw = await kv.get(`unlock:${token}`);
  if (!raw) {
    // Token not found — Ping may not have arrived yet, or token expired.
    // Redirect to guide with a message to try again or use license key.
    return redirect(`/guides/${fallbackSlug}?pending=true`);
  }

  const purchase = JSON.parse(raw) as {
    productIds: string[];
    slug: string;
  };

  // Unlock all products from this purchase
  const unlocked: string[] =
    (await session?.get("unlockedProducts")) ?? [];
  for (const pid of purchase.productIds) {
    if (!unlocked.includes(pid)) {
      unlocked.push(pid);
    }
  }
  await session?.set("unlockedProducts", unlocked);

  // Clean up the token (one-time use)
  await kv.delete(`unlock:${token}`);

  return redirect(`/guides/${purchase.slug}`);
};
