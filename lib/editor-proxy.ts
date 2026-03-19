import { createEditorMcpProxy } from "agent-cms";
import { getCmsHandler } from "./cms-handler";
import { env } from "cloudflare:workers";

const APP_BASE_URL = "https://www.rvkfoodie.is";

let cached: ReturnType<typeof createEditorMcpProxy> | null = null;

export function getEditorProxy() {
  if (cached) return cached;

  const cms = getCmsHandler();

  // Route CMS calls in-process instead of over the network
  const inProcessFetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = input instanceof Request ? input.method : (init?.method ?? "GET");
    const hasBody = input instanceof Request ? input.body !== null : init?.body != null;
    const bodyIsStream = input instanceof Request
      ? input.body instanceof ReadableStream
      : init?.body instanceof ReadableStream;
    const duplex = (init as Record<string, unknown>)?.duplex;

    console.log(`[inProcessFetch] ${method} ${url} body=${hasBody} bodyIsStream=${bodyIsStream} duplex=${duplex}`);

    if (url.startsWith(APP_BASE_URL + "/cms/") || url.startsWith("http://cms/")) {
      const cmsPath = url.replace(APP_BASE_URL + "/cms", "").replace("http://cms", "") || "/";
      const internalUrl = new URL(cmsPath, "http://localhost");
      console.log(`[inProcessFetch] → in-process cms.fetch(${internalUrl.pathname})`);
      const t0 = performance.now();
      try {
        const request = new Request(
          internalUrl,
          init ?? (input instanceof Request ? input : undefined),
        );
        const response = await cms.fetch(request);
        const elapsed = (performance.now() - t0).toFixed(0);
        console.log(`[inProcessFetch] ← cms.fetch ${response.status} in ${elapsed}ms, body=${response.body !== null}`);
        return response;
      } catch (err) {
        const elapsed = (performance.now() - t0).toFixed(0);
        console.error(`[inProcessFetch] ← cms.fetch threw after ${elapsed}ms:`, err);
        throw err;
      }
    }
    // Catch any request to our own origin to avoid self-referencing fetch (causes 522)
    if (url.startsWith(APP_BASE_URL + "/")) {
      console.warn(`[inProcessFetch] ⚠ FALLING THROUGH to external fetch for same-origin: ${url}`);
    }
    console.log(`[inProcessFetch] → external fetch(${url})`);
    return fetch(input, init);
  };

  cached = createEditorMcpProxy({
    appBaseUrl: APP_BASE_URL,
    cmsBaseUrl: APP_BASE_URL + "/cms",
    cmsWriteKey: env.CMS_WRITE_KEY,
    oauthSecret: env.OAUTH_SECRET,
    fetch: inProcessFetch,
    mountPath: "/editor-access",
    getEditor: async (request: Request) => {
      const cookie = request.headers.get("cookie") ?? "";
      const match = cookie.match(/editor_session=([^;]+)/);
      if (!match) return null;
      const decoded = decodeURIComponent(match[1]);
      const colonIdx = decoded.indexOf(":");
      if (colonIdx === -1) return null;
      const name = decoded.slice(0, colonIdx);
      const token = decoded.slice(colonIdx + 1);
      if (!name || !token.startsWith("etk_")) return null;
      return { id: name.toLowerCase().replace(/\s+/g, "-"), name };
    },
    getLoginUrl: () => "/editor-access/login",
    cmsTokenTtlSeconds: 31_536_000, // 1 year
    oauthTokenTtlSeconds: 31_536_000, // 1 year
    resourceName: "rvkfoodie editor",
  });

  return cached;
}

export function getEditorPassword(): string {
  return env.EDITOR_PASSWORD;
}

