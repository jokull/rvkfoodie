

/** Convert Payload Lexical JSON to HTML string */
export function lexicalToHtml(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = (data as { root?: { children?: unknown[] } }).root;
  if (!root?.children) return "";
  return root.children.map(renderNode).join("");
}

function renderNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  const type = n.type as string;

  if (type === "paragraph") {
    const inner = renderChildren(n);
    if (!inner.trim()) return "";
    return `<p>${inner}</p>`;
  }

  if (type === "heading") {
    const tag = (n.tag as string) || "h2";
    return `<${tag}>${renderChildren(n)}</${tag}>`;
  }

  if (type === "text") {
    let text = escapeHtml(n.text as string);
    const format = (n.format as number) || 0;
    if (format & 1) text = `<strong>${text}</strong>`;
    if (format & 2) text = `<em>${text}</em>`;
    if (format & 4) text = `<s>${text}</s>`;
    if (format & 8) text = `<u>${text}</u>`;
    if (format & 16) text = `<code>${text}</code>`;
    return text;
  }

  if (type === "link") {
    const fields = n.fields as Record<string, unknown> | undefined;
    const url = (fields?.url ?? (n.url as string)) || "#";
    const target = fields?.newTab ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${escapeHtml(String(url))}"${target}>${renderChildren(n)}</a>`;
  }

  if (type === "list") {
    const tag = (n.listType as string) === "number" ? "ol" : "ul";
    return `<${tag}>${renderChildren(n)}</${tag}>`;
  }

  if (type === "listitem") {
    return `<li>${renderChildren(n)}</li>`;
  }

  if (type === "quote") {
    return `<blockquote>${renderChildren(n)}</blockquote>`;
  }

  if (type === "upload") {
    const value = n.value as Record<string, unknown> | undefined;
    const src = value?.url as string;
    const alt = value?.alt as string || "";
    if (!src) return "";
    return `<figure class="my-8 rounded-2xl overflow-hidden"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="w-full rounded-2xl" loading="lazy" /></figure>`;
  }

  if (type === "linebreak") {
    return "<br />";
  }

  // Fallback: render children if they exist
  if (Array.isArray(n.children)) {
    return renderChildren(n);
  }

  return "";
}

function renderChildren(node: Record<string, unknown>): string {
  const children = node.children as unknown[];
  if (!Array.isArray(children)) return "";
  return children.map(renderNode).join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
