import { createCMSHandler } from "agent-cms";

interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  ENVIRONMENT: string;
  ASSET_BASE_URL: string;
  CMS_READ_KEY?: string;
  CMS_WRITE_KEY?: string;
  AI?: unknown;
  VECTORIZE?: unknown;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return createCMSHandler({
      bindings: {
        db: env.DB,
        assets: env.ASSETS,
        environment: env.ENVIRONMENT,
        assetBaseUrl: env.ASSET_BASE_URL,
        readKey: env.CMS_READ_KEY,
        writeKey: env.CMS_WRITE_KEY,
        ai: env.AI as Parameters<typeof createCMSHandler>[0]["bindings"]["ai"],
        vectorize: env.VECTORIZE as Parameters<typeof createCMSHandler>[0]["bindings"]["vectorize"],
      },
    }).fetch(request);
  },
};
