import {
  getSessionData,
  setSessionData,
  sessionCookieHeader,
} from "@/lib/session";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const licenseKey = formData.get("license_key")?.toString().trim();
  const productId = formData.get("product_id")?.toString();
  const slug = formData.get("slug")?.toString();

  if (!licenseKey || !productId || !slug) {
    return Response.redirect(
      new URL(`/guides/${slug ?? ""}?error=invalid_key`, url.origin),
    );
  }

  try {
    const response = await fetch(
      "https://api.gumroad.com/v2/licenses/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_id: productId,
          license_key: licenseKey,
          increment_uses_count: "false",
        }),
      },
    );

    const data = (await response.json()) as {
      success: boolean;
      purchase?: { refunded?: boolean; chargebacked?: boolean };
    };

    if (
      data.success &&
      !data.purchase?.refunded &&
      !data.purchase?.chargebacked
    ) {
      const unlocked: string[] =
        (await getSessionData<string[]>("unlockedProducts")) ?? [];
      if (!unlocked.includes(productId)) {
        unlocked.push(productId);
        const { sessionId, isNew } = await setSessionData(
          "unlockedProducts",
          unlocked,
        );
        const headers = new Headers({
          Location: new URL(`/guides/${slug}`, url.origin).toString(),
        });
        if (isNew) {
          headers.set("Set-Cookie", sessionCookieHeader(sessionId));
        }
        return new Response(null, { status: 302, headers });
      }
      return Response.redirect(new URL(`/guides/${slug}`, url.origin));
    }
  } catch {
    // Gumroad API error — fall through to error redirect
  }

  return Response.redirect(
    new URL(`/guides/${slug}?error=invalid_key`, url.origin),
  );
}
