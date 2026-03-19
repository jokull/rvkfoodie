"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CmsEditProvider,
  CmsRecord,
  CmsField as CmsFieldBase,
  CmsText as CmsTextBase,
  CmsImage as CmsImageBase,
} from "@agent-cms/visual-edit-react";

declare global {
  interface Window {
    __EDITOR__?: { name: string; token: string };
  }
}

function getEditor(): { name: string; token: string } | null {
  if (typeof window === "undefined") return null;
  return window.__EDITOR__ ?? null;
}

/** CmsField that calls router.refresh() after save */
export function CmsField(props: React.ComponentProps<typeof CmsFieldBase>) {
  const router = useRouter();
  const onSaved = useCallback(() => {
    props.onSaved?.();
    router.refresh();
  }, [props.onSaved, router]);
  return <CmsFieldBase {...props} onSaved={onSaved} />;
}

/** CmsText that calls router.refresh() after save */
export function CmsText(props: React.ComponentProps<typeof CmsTextBase>) {
  const router = useRouter();
  const onSaved = useCallback(() => {
    props.onSaved?.();
    router.refresh();
  }, [props.onSaved, router]);
  return <CmsTextBase {...props} onSaved={onSaved} />;
}

/** CmsImage that calls router.refresh() after replacement */
export function CmsImage(props: React.ComponentProps<typeof CmsImageBase>) {
  const router = useRouter();
  const onReplaced = useCallback(() => {
    props.onReplaced?.();
    router.refresh();
  }, [props.onReplaced, router]);
  return <CmsImageBase {...props} onReplaced={onReplaced} />;
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
  const editor = useMemo(() => getEditor(), []);
  const router = useRouter();

  if (!editor) return <>{children}</>;

  return (
    <CmsEditProvider endpoint="/cms" token={editor.token}>
      <CmsRecord
        recordId={recordId}
        modelApiKey={modelApiKey}
        onPublished={() => router.refresh()}
      >
        {children}
      </CmsRecord>
    </CmsEditProvider>
  );
}

export function EditBar() {
  const editor = useMemo(() => getEditor(), []);
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
