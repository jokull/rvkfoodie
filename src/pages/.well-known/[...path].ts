import type { APIRoute } from "astro";
import { getEditorProxy } from "../../lib/editor-proxy";

export const prerender = false;

const handler: APIRoute = async ({ request }) => {
  return getEditorProxy().fetch(request);
};

export const GET = handler;
