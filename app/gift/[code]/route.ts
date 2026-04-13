const GIFT_CODES = new Set([
  "QlPdzlsH6lWiFs9G",
  "kdz3w6sC6V73qoYN",
  "DfjGwIsN2RFjoeeF",
  "wyWMkClJn6UbqRp9",
  "FcCh_em6BK6rsAOh",
]);

const GIFT_TTL = 60 * 60 * 24 * 365;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  if (!GIFT_CODES.has(code)) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Location", "/");
  headers.set(
    "Set-Cookie",
    `__gift=1; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${GIFT_TTL}`,
  );

  return new Response(null, { status: 307, headers });
}
