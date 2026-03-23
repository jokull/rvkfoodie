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
        r2AccessKeyId: env.R2_ACCESS_KEY_ID,
        r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
        r2BucketName: "rvkfoodie-cms",
        cfAccountId: "561f024b3ba2bbafa2a67ec9b911693c",
      },
    });
  return cached;
}
