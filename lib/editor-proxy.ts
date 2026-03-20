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

    if (url.startsWith(APP_BASE_URL + "/cms/") || url.startsWith("http://cms/")) {
      const cmsPath = url.replace(APP_BASE_URL + "/cms", "").replace("http://cms", "") || "/";
      const internalUrl = new URL(cmsPath, "http://localhost");
      const request = new Request(
        internalUrl,
        init ?? (input instanceof Request ? input : undefined),
      );
      return cms.fetch(request);
    }
    // Catch any request to our own origin to avoid self-referencing fetch (causes 522)
    if (url.startsWith(APP_BASE_URL + "/")) {
      console.warn(`[inProcessFetch] unexpected same-origin fetch: ${url}`);
    }
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

