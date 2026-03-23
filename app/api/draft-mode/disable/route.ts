/**
 * GET /api/draft-mode/disable — clears the preview cookie and redirects home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = url.searchParams.get("redirect") ?? "/";

  const headers = new Headers();
  headers.set("Location", redirect);
  headers.set(
    "Set-Cookie",
    "__preview=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
  );

  return new Response(null, { status: 307, headers });
}
