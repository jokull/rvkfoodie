import { cookies } from "next/headers";
import {
  getSessionData,
  setSessionData,
  SESSION_COOKIE,
  SESSION_TTL,
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

    const data: {
      success: boolean;
      purchase?: { refunded?: boolean; chargebacked?: boolean };
    } = await response.json();

    if (
      data.success &&
      !data.purchase?.refunded &&
      !data.purchase?.chargebacked
    ) {
      const cookieStore = await cookies();
      const existingId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

      const unlocked: string[] = existingId
        ? ((await getSessionData<string[]>(existingId, "unlockedProducts")) ??
          [])
        : [];
      if (!unlocked.includes(productId)) {
        unlocked.push(productId);
        const sessionId = await setSessionData(
          existingId,
          "unlockedProducts",
          unlocked,
        );
        if (!existingId) {
          cookieStore.set(SESSION_COOKIE, sessionId, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: true,
            maxAge: SESSION_TTL,
          });
        }
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
