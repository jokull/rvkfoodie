import type { APIRoute } from "astro";

/**
 * Generates a unique unlock token, stores it in the user's session,
 * and redirects to Gumroad checkout with the token as a URL param.
 * After purchase, Gumroad Ping sends the token back to /api/gumroad-ping.
 */
export const GET: APIRoute = async ({ url, session, redirect }) => {
  const slug = url.searchParams.get("slug");
  const gumroadUrl = url.searchParams.get("url");

  if (!slug || !gumroadUrl) {
    return redirect("/");
  }

  // Generate a random token
  const token = crypto.randomUUID();

  // Store in session so we can match later
  await session?.set("unlockToken", token);

  // Redirect to Gumroad with ?wanted=true and the unlock token
  const sep = gumroadUrl.includes("?") ? "&" : "?";
  return redirect(
    `${gumroadUrl}${sep}wanted=true&unlock_token=${token}`,
  );
};
