import { createCMSHandler } from "agent-cms";
import { env } from "cloudflare:workers";

let cached: ReturnType<typeof createCMSHandler> | null = null;

export function getCmsHandler() {
  cached ??= createCMSHandler({
      bindings: {
        db: env.DB,
        assets: env.R2_ASSETS,
        environment: env.ENVIRONMENT,
        assetBaseUrl: env.ASSET_BASE_URL,
        writeKey: env.CMS_WRITE_KEY,
        ai: env.AI,
        vectorize: env.VECTORIZE,
        siteUrl: "https://www.rvkfoodie.is",
      },
    });
  return cached;
}
