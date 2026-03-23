import { getCmsHandler } from "@/lib/cms-handler";

/**
 * GET /api/draft-mode/enable?token=pvt_...&redirect=/guides/food-guide
 *
 * Validates the preview token against the CMS, sets a __preview cookie,
 * and redirects to the target page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const redirect = url.searchParams.get("redirect") ?? "/";

  if (!token) {
    return new Response("Missing token parameter", { status: 400 });
  }

  // Validate the token against the CMS
  const cms = getCmsHandler();
  const validateRes = await cms.fetch(
    new Request(`http://localhost/api/preview-tokens/validate?token=${encodeURIComponent(token)}`),
  );

  if (!validateRes.ok) {
    return new Response("Failed to validate preview token", { status: 502 });
  }

  const { valid, expiresAt } = (await validateRes.json()) satisfies {
    valid: boolean;
    expiresAt?: string;
  };

  if (!valid) {
    return new Response("Invalid or expired preview token", { status: 401 });
  }

  // Set preview cookie with the token — expires when the token expires
  const maxAge = expiresAt
    ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : 86400;

  const headers = new Headers();
  headers.set("Location", redirect);
  headers.set(
    "Set-Cookie",
    `__preview=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`,
  );

  return new Response(null, { status: 307, headers });
}
