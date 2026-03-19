import { createCMSHandler } from "agent-cms";
import { env } from "cloudflare:workers";

const cmsEnv = env as typeof env & { CMS_READ_KEY?: string; CMS_WRITE_KEY: string };

let cached: ReturnType<typeof createCMSHandler> | null = null;

export function getCmsHandler() {
  if (!cached) {
    cached = createCMSHandler({
      bindings: {
        db: cmsEnv.DB,
        assets: cmsEnv.R2_ASSETS,
        environment: cmsEnv.ENVIRONMENT,
        assetBaseUrl: cmsEnv.ASSET_BASE_URL,
        readKey: cmsEnv.CMS_READ_KEY,
        writeKey: cmsEnv.CMS_WRITE_KEY,
        ai: cmsEnv.AI,
        vectorize: cmsEnv.VECTORIZE,
      },
    });
  }
  return cached;
}
