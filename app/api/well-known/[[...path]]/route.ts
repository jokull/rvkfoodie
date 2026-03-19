import { getEditorProxy } from "@/lib/editor-proxy";

async function handler(request: Request) {
  // Rewrite rewrites /.well-known/* to /api/well-known/* — we need to
  // reconstruct the original /.well-known/ URL for the editor proxy
  const url = new URL(request.url);
  const originalPath = url.pathname.replace("/api/well-known", "/.well-known");
  const originalUrl = new URL(originalPath + url.search, url.origin);
  const proxiedRequest = new Request(originalUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
  return getEditorProxy().fetch(proxiedRequest);
}

export const GET = handler;
