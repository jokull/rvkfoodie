import { getEditorProxy } from "@/lib/editor-proxy";
import { corsPreflightResponse, withCors } from "@/lib/cors";

async function handler(request: Request) {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  // Rewrite rewrites /.well-known/* to /api/well-known/* — we need to
  // reconstruct the original /.well-known/ URL for the editor proxy
  const url = new URL(request.url);
  const originalPath = url.pathname.replace("/api/well-known", "/.well-known");
  const originalUrl = new URL(originalPath + url.search, url.origin);
  const proxiedRequest = new Request(originalUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
  return withCors(await getEditorProxy().fetch(proxiedRequest));
}

export const GET = handler;
export const OPTIONS = handler;
