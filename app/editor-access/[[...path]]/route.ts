import {
  getEditorProxy,
  getEditorPassword,
  sha256,
} from "@/lib/editor-proxy";

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
      headers: { "Content-Type": "text/html" },
    },
  );
}

async function handler(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/editor-access/login") {
    if (request.method === "POST") {
      const form = await request.formData();
      const name = form.get("name")?.toString().trim();
      const password = form.get("password")?.toString();
      const returnTo = form.get("returnTo")?.toString() ?? "/";
      if (!name || password !== getEditorPassword()) {
        return loginPage(returnTo, "Wrong password");
      }
      const hash = await sha256(name + ":" + getEditorPassword());
      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": `editor_session=${encodeURIComponent(name + ":" + hash)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=3600`,
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

  return getEditorProxy().fetch(request);
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
