import { cookies } from "next/headers";
import { setSessionData, SESSION_COOKIE, SESSION_TTL } from "@/lib/session";

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

  const cookieStore = await cookies();
  const existingId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const token = crypto.randomUUID();
  const sessionId = await setSessionData(existingId, "unlockToken", token);

  const sep = gumroadUrl.includes("?") ? "&" : "?";
  const location = `${gumroadUrl}${sep}wanted=true&unlock_token=${token}`;

  if (!existingId) {
    cookieStore.set(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: SESSION_TTL,
    });
  }

  return Response.redirect(location);
}
