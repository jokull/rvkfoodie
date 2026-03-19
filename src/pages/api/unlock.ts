import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, session, redirect }) => {
  const formData = await request.formData();
  const licenseKey = formData.get("license_key")?.toString().trim();
  const productId = formData.get("product_id")?.toString();
  const slug = formData.get("slug")?.toString();

  if (!licenseKey || !productId || !slug) {
    return redirect(`/guides/${slug ?? ""}?error=invalid_key`);
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
        (await session?.get("unlockedProducts")) ?? [];
      if (!unlocked.includes(productId)) {
        unlocked.push(productId);
        await session?.set("unlockedProducts", unlocked);
      }
      return redirect(`/guides/${slug}`);
    }
  } catch {
    // Gumroad API error — fall through to error redirect
  }

  return redirect(`/guides/${slug}?error=invalid_key`);
};
