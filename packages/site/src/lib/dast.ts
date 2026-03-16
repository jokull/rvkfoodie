/**
 * DAST (DatoCMS Abstract Syntax Tree) to HTML renderer.
 * Uses datocms-structured-text-to-html-string for standard nodes.
 * Custom block rendering handled separately by the calling templates.
 */

import { render } from "datocms-structured-text-to-html-string";

/**
 * Render DAST structured text to HTML string.
 * Skips block nodes (those are rendered by templates).
 */
export function dastToHtml(st: any): string {
  if (!st) return "";

  // Handle agent-cms format: { value: { schema: "dast", document: {...} }, blocks: {...} }
  // The render function expects: { value: { schema: "dast", document: {...} } }
  // Blocks in our format are a map, but the library expects an array

  const doc = st.value || st;
  if (!doc?.schema && !doc?.document) return "";

  try {
    const result = render(
      { value: doc },
      {
        renderBlock: () => "", // Skip blocks — handled by templates
      },
    );
    return result || "";
  } catch {
    // Fallback: manual render if the library can't handle the format
    return manualRender(doc);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderInline(node: any): string {
  if (!node) return "";
  if (node.type === "span") {
    let html = escapeHtml(node.value || "");
    for (const mark of node.marks || []) {
      if (mark === "strong") html = `<strong>${html}</strong>`;
      else if (mark === "emphasis") html = `<em>${html}</em>`;
      else if (mark === "underline") html = `<u>${html}</u>`;
      else if (mark === "code") html = `<code>${html}</code>`;
    }
    return html;
  }
  if (node.type === "link") {
    return `<a href="${escapeHtml(node.url)}">${(node.children || []).map(renderInline).join("")}</a>`;
  }
  return node.value ? escapeHtml(node.value) : "";
}

function renderNode(node: any): string {
  if (!node) return "";
  if (node.type === "paragraph") return `<p>${(node.children || []).map(renderInline).join("")}</p>`;
  if (node.type === "heading") {
    const tag = `h${node.level || 2}`;
    return `<${tag}>${(node.children || []).map(renderInline).join("")}</${tag}>`;
  }
  if (node.type === "list") {
    const tag = node.style === "numbered" ? "ol" : "ul";
    return `<${tag}>${(node.children || []).map((li: any) =>
      `<li>${(li.children || []).map(renderNode).join("")}</li>`
    ).join("")}</${tag}>`;
  }
  if (node.type === "blockquote") return `<blockquote>${(node.children || []).map(renderNode).join("")}</blockquote>`;
  if (node.type === "block") return ""; // Skip blocks
  return "";
}

function manualRender(doc: any): string {
  const document = doc.document || doc;
  if (!document?.children) return "";
  return document.children.map(renderNode).join("\n");
}
