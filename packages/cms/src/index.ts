import { createCMSHandler, type CmsBindings } from "agent-cms";

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

// Cache the handler at module scope so the GraphQL schema is built once
// and reused across requests within the same Worker isolate.
let cachedHandler: ReturnType<typeof createCMSHandler> | null = null;
let cachedEnv: Env | null = null;

function getHandler(env: Env) {
  // Recreate only if env bindings changed (new isolate)
  if (!cachedHandler || cachedEnv !== env) {
    cachedHandler = createCMSHandler({
      bindings: {
        db: env.DB,
        assets: env.ASSETS,
        environment: env.ENVIRONMENT,
        assetBaseUrl: env.ASSET_BASE_URL,
        readKey: env.CMS_READ_KEY,
        writeKey: env.CMS_WRITE_KEY,
        ai: env.AI as CmsBindings["ai"],
        vectorize: env.VECTORIZE as CmsBindings["vectorize"],
      },
    });
    cachedEnv = env;
  }
  return cachedHandler;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return getHandler(env).fetch(request);
  },
};
