import { createEditorMcpProxy } from "agent-cms";
import { getCmsHandler } from "./cms-handler";
import { env } from "cloudflare:workers";

const cmsEnv = env as typeof env & {
  CMS_WRITE_KEY?: string;
  OAUTH_SECRET?: string;
  EDITOR_PASSWORD?: string;
};

const APP_BASE_URL = "https://www.rvkfoodie.is";

let cached: ReturnType<typeof createEditorMcpProxy> | null = null;

export function getEditorProxy() {
  if (cached) return cached;

  const cms = getCmsHandler();

  // Route CMS calls in-process instead of over the network
  const inProcessFetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(APP_BASE_URL + "/cms/") || url.startsWith("http://cms/")) {
      const cmsPath = url.replace(APP_BASE_URL + "/cms", "").replace("http://cms", "") || "/";
      const request = new Request(
        new URL(cmsPath, "http://localhost"),
        init ?? (input instanceof Request ? input : undefined),
      );
      return cms.fetch(request);
    }
    return fetch(input, init);
  };

  cached = createEditorMcpProxy({
    appBaseUrl: APP_BASE_URL,
    cmsBaseUrl: APP_BASE_URL + "/cms",
    cmsWriteKey: cmsEnv.CMS_WRITE_KEY ?? "",
    oauthSecret: cmsEnv.OAUTH_SECRET ?? crypto.randomUUID(),
    fetch: inProcessFetch,
    mountPath: "/editor-access",
    getEditor: async (request: Request) => {
      const cookie = request.headers.get("cookie") ?? "";
      const match = cookie.match(/editor_session=([^;]+)/);
      if (!match) return null;
      const [name, hash] = decodeURIComponent(match[1]).split(":");
      if (!name || !hash) return null;
      const expectedHash = await sha256(name + ":" + (cmsEnv.EDITOR_PASSWORD ?? ""));
      if (hash !== expectedHash) return null;
      return { id: name.toLowerCase().replace(/\s+/g, "-"), name };
    },
    getLoginUrl: () => "/editor-access/login",
    cmsTokenTtlSeconds: 3600,
    oauthTokenTtlSeconds: 3600,
    resourceName: "rvkfoodie editor",
  });

  return cached;
}

export function getEditorPassword(): string {
  return cmsEnv.EDITOR_PASSWORD ?? "";
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { sha256 };
