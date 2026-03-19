import type { APIRoute } from "astro";
import { getCmsHandler } from "../../lib/cms-handler";

export const prerender = false;

/** Forward all /cms/* requests to the agent-cms handler with the /cms prefix stripped. */
const handler: APIRoute = async ({ request }) => {
  try {
    const cms = getCmsHandler();
    const url = new URL(request.url);
    const cmsPath = url.pathname.replace(/^\/cms/, "") || "/";
    const cmsUrl = new URL(cmsPath + url.search, url.origin);
    const cmsRequest = new Request(cmsUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // @ts-expect-error -- duplex required for streaming body in Workers runtime
      duplex: "half",
    });
    return await cms.fetch(cmsRequest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[cms-proxy] uncaught:", message, stack);
    return new Response(JSON.stringify({ error: message, stack: stack?.split("\n").slice(0, 8) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
