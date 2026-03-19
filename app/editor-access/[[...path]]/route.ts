import { getEditorProxy } from "@/lib/editor-proxy";
import { corsPreflightResponse, withCors } from "@/lib/cors";

async function handler(request: Request) {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  try {
    const response = await getEditorProxy().fetch(request);
    return withCors(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[editor-mcp]", message);
    return withCors(
      new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
export const DELETE = handler;
