import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Receives Gumroad Ping webhook after a purchase.
 * Stores the purchase in KV so the guide page auto-unlock can find it.
 *
 * Gumroad sends x-www-form-urlencoded POST with fields including:
 * - product_id, seller_id, email, sale_id, refunded, test
 * - url_params (JSON string with our unlock_token)
 * - license_key (if enabled)
 */

// Product ID → guide slug mapping
const PRODUCT_SLUGS: Record<string, string> = {
  "2XvImS0EDlgIJTnyND9IPg==": "food-guide",
  "Nh29BBzZgbR9j_zbd7G6gQ==": "bar-crawl",
  "tQ2p0Rc-AOTIB9MbCgUAug==": "golden-circle",
  "vV5i0_395VCDyRZPNuw2gQ==": "bundle",
};

// Products included in the bundle
const BUNDLE_PRODUCTS = [
  "2XvImS0EDlgIJTnyND9IPg==", // food-guide
  "Nh29BBzZgbR9j_zbd7G6gQ==", // bar-crawl
];

export const POST: APIRoute = async ({ request }) => {
  const kv = env.PURCHASES as KVNamespace;

  const formData = await request.formData();
  const productId = formData.get("product_id")?.toString();
  const refunded = formData.get("refunded")?.toString();
  const saleId = formData.get("sale_id")?.toString();
  const email = formData.get("email")?.toString();
  const urlParamsRaw = formData.get("url_params")?.toString();

  if (refunded === "true") {
    return new Response("OK", { status: 200 });
  }

  if (!productId || !PRODUCT_SLUGS[productId]) {
    return new Response("OK", { status: 200 });
  }

  // Parse unlock_token from url_params
  let unlockToken: string | undefined;
  if (urlParamsRaw) {
    try {
      const params = JSON.parse(urlParamsRaw);
      unlockToken = params.unlock_token;
    } catch {
      // url_params might be malformed
    }
  }

  const productIds =
    productId === "vV5i0_395VCDyRZPNuw2gQ=="
      ? BUNDLE_PRODUCTS
      : [productId];

  const slug = PRODUCT_SLUGS[productId];

  const purchaseData = JSON.stringify({
    productIds,
    slug: slug === "bundle" ? "food-guide" : slug,
    email,
    saleId,
    createdAt: new Date().toISOString(),
  });

  // Store by unlock token (primary lookup for redirect flow)
  if (unlockToken) {
    await kv.put(`unlock:${unlockToken}`, purchaseData, {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  }

  // Store by sale_id (fallback lookup)
  if (saleId) {
    await kv.put(`sale:${saleId}`, purchaseData, {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }

  // Store by email (for "already purchased?" lookup)
  if (email) {
    const existing = await kv.get(`email:${email}`);
    const products: string[] = existing ? JSON.parse(existing) : [];
    for (const pid of productIds) {
      if (!products.includes(pid)) products.push(pid);
    }
    await kv.put(`email:${email}`, JSON.stringify(products), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  }

  return new Response("OK", { status: 200 });
};
