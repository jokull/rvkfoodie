import {
  getEditorProxy,
  getEditorPassword,
} from "@/lib/editor-proxy";
import { getCmsHandler } from "@/lib/cms-handler";
import { env } from "cloudflare:workers";
import { corsPreflightResponse, withCors } from "@/lib/cors";

function loginPage(returnTo: string, error?: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html><head><title>Editor Login</title>
<style>body{font-family:system-ui;max-width:400px;margin:80px auto;padding:0 20px}
input{display:block;width:100%;padding:8px;margin:8px 0;box-sizing:border-box;border:1px solid #ccc;border-radius:4px}
button{padding:10px 20px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer}
.error{color:#dc2626;margin-bottom:12px}</style></head>
<body>
<h1>Editor Login</h1>
${error ? `<p class="error">${error}</p>` : ""}
<form method="POST">
<input type="hidden" name="returnTo" value="${returnTo}">
<label>Your name<input name="name" required placeholder="e.g. Jökull"></label>
<label>Password<input name="password" type="password" required></label>
<button type="submit">Log in</button>
</form>
</body></html>`,
    {
      status: error ? 401 : 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function handler(request: Request) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  if (url.pathname === "/editor-access/login") {
    if (request.method === "POST") {
      const form = await request.formData();
      const name = form.get("name")?.toString().trim();
      const password = form.get("password")?.toString();
      const returnTo = form.get("returnTo")?.toString() ?? "/";
      if (!name || password !== getEditorPassword()) {
        return loginPage(returnTo, "Wrong password");
      }

      // Mint a 1-year editor token and store it in the cookie
      const writeKey = (env as typeof env & { CMS_WRITE_KEY?: string }).CMS_WRITE_KEY;
      const cms = getCmsHandler();
      const tokenResponse = await cms.fetch(
        new Request("http://localhost/api/tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${writeKey}`,
          },
          body: JSON.stringify({ name, expiresIn: 31_536_000 }),
        }),
      );
      if (!tokenResponse.ok) {
        return loginPage(returnTo, "Failed to create editor token");
      }
      const { token } = (await tokenResponse.json()) as { token: string };

      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": `editor_session=${encodeURIComponent(name + ":" + token)}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`,
          Location: returnTo,
        },
      });
    }
    return loginPage(url.searchParams.get("returnTo") ?? "/");
  }

  if (url.pathname === "/editor-access/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        "Set-Cookie":
          "editor_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
        Location: "/",
      },
    });
  }

  const rid = Math.random().toString(36).slice(2, 8);
  const t0 = performance.now();
  const auth = request.headers.get("authorization");
  const authSummary = auth
    ? `${auth.slice(0, 15)}...${auth.slice(-10)} (${auth.length} chars)`
    : "none";
  const contentType = request.headers.get("content-type") ?? "none";
  const accept = request.headers.get("accept") ?? "none";
  const contentLength = request.headers.get("content-length") ?? "unknown";
  const hasBody = request.body !== null;
  const bodyIsStream = request.body instanceof ReadableStream;
  const origin = request.headers.get("origin") ?? "none";

  console.log(
    `[editor-mcp:${rid}] ▶ ${request.method} ${url.pathname}` +
    ` | origin=${origin} auth=${authSummary}` +
    ` | ct=${contentType} accept=${accept}` +
    ` | cl=${contentLength} body=${hasBody} stream=${bodyIsStream}`,
  );

  try {
    const response = await getEditorProxy().fetch(request);
    const elapsed = (performance.now() - t0).toFixed(0);
    const respCt = response.headers.get("content-type") ?? "none";
    const respHasBody = response.body !== null;
    console.log(
      `[editor-mcp:${rid}] ◀ ${response.status} in ${elapsed}ms` +
      ` | ct=${respCt} body=${respHasBody}`,
    );
    return withCors(response);
  } catch (error) {
    const elapsed = (performance.now() - t0).toFixed(0);
    console.error(
      `[editor-mcp:${rid}] ✘ threw after ${elapsed}ms:`,
      error,
    );
    return withCors(
      new Response(JSON.stringify({ error: String(error) }), {
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
