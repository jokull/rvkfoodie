import { getEditorProxy } from "@/lib/editor-proxy";

async function handler(request: Request) {
  return getEditorProxy().fetch(request);
}

export const GET = handler;
