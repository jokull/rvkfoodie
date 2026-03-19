"use client";

import { useMemo } from "react";
import {
  CmsEditProvider,
  CmsRecord,
} from "@agent-cms/visual-edit-react";

export { CmsField, CmsText, CmsImage } from "@agent-cms/visual-edit-react";

function getEditorCookie(): { name: string; token: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/editor_session=([^;]+)/);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]);
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return null;
  const name = decoded.slice(0, colonIdx);
  const token = decoded.slice(colonIdx + 1);
  if (!name || !token.startsWith("etk_")) return null;
  return { name, token };
}

export function EditWrapper({
  recordId,
  modelApiKey,
  children,
}: {
  recordId: string;
  modelApiKey: string;
  children: React.ReactNode;
}) {
  const editor = useMemo(() => getEditorCookie(), []);

  if (!editor) return <>{children}</>;

  return (
    <CmsEditProvider endpoint="/cms" token={editor.token}>
      <CmsRecord recordId={recordId} modelApiKey={modelApiKey}>
        {children}
      </CmsRecord>
    </CmsEditProvider>
  );
}

export function EditBar() {
  const editor = useMemo(() => getEditorCookie(), []);
  if (!editor) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: "#2563eb",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: 9999,
        fontSize: 13,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <span>Editing as {editor.name}</span>
      <a
        href="/editor-access/logout"
        style={{ color: "#fff", opacity: 0.8, textDecoration: "underline" }}
      >
        Log out
      </a>
    </div>
  );
}
