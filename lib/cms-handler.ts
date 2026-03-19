import { createCMSHandler } from "agent-cms";
import { env } from "cloudflare:workers";

let cached: ReturnType<typeof createCMSHandler> | null = null;

export function getCmsHandler() {
  if (!cached) {
    cached = createCMSHandler({
      bindings: {
        db: env.DB,
        assets: env.R2_ASSETS,
        environment: env.ENVIRONMENT,
        assetBaseUrl: env.ASSET_BASE_URL,
        writeKey: env.CMS_WRITE_KEY,
        ai: env.AI,
        vectorize: env.VECTORIZE,
      },
    });
  }
  return cached;
}
