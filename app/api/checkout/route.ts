import { setSessionData, sessionCookieHeader } from "@/lib/session";

/**
 * Generates a unique unlock token, stores it in the user's session,
 * and redirects to Gumroad checkout with the token as a URL param.
 * After purchase, Gumroad Ping sends the token back to /api/gumroad-ping.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const gumroadUrl = url.searchParams.get("url");

  if (!slug || !gumroadUrl) {
    return Response.redirect(new URL("/", url.origin));
  }

  // Generate a random token
  const token = crypto.randomUUID();

  // Store in session so we can match later
  const { sessionId, isNew } = await setSessionData("unlockToken", token);

  // Redirect to Gumroad with ?wanted=true and the unlock token
  const sep = gumroadUrl.includes("?") ? "&" : "?";
  const location = `${gumroadUrl}${sep}wanted=true&unlock_token=${token}`;

  const headers = new Headers({ Location: location });
  if (isNew) {
    headers.set("Set-Cookie", sessionCookieHeader(sessionId));
  }

  return new Response(null, { status: 302, headers });
}
