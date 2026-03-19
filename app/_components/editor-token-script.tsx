import { cookies } from "next/headers";

/**
 * Server component that injects the editor token into the page
 * as a global variable, so client components can read it.
 * The cookie itself stays HttpOnly.
 */
export async function EditorTokenScript() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("editor_session")?.value;
  if (!raw) return null;

  const decoded = decodeURIComponent(raw);
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return null;

  const name = decoded.slice(0, colonIdx);
  const token = decoded.slice(colonIdx + 1);
  if (!name || !token.startsWith("etk_")) return null;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__EDITOR__=${JSON.stringify({ name, token })}`,
      }}
    />
  );
}
