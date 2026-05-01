import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";

type Props = {
  doc: Doc | null;
  onSave: (slug: string, content: string) => Promise<void>;
};

export function Editor({ doc, onSave }: Props) {
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSlug = useRef<string | null>(null);

  useEffect(() => {
    if (!doc) {
      setDraft("");
      lastSlug.current = null;
      return;
    }
    if (doc.slug !== lastSlug.current) {
      setDraft(doc.content);
      lastSlug.current = doc.slug;
      setSavedAt(doc.updatedAt);
    }
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    if (draft === doc.content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(doc.slug, draft);
      setSavedAt(Date.now());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, doc, onSave]);

  const html = useMemo(() => renderMarkdown(draft), [draft]);

  if (!doc) {
    return (
      <div className="editor empty">
        <p className="muted">Select a document or create a new one to get started.</p>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <span className="doc-slug-label">{doc.slug}.md</span>
        <span className="muted small">
          {savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : "unsaved"}
        </span>
      </div>
      <div className="editor-panes">
        <textarea
          className="editor-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck
          placeholder="# Title&#10;&#10;Write markdown here..."
        />
        <div
          className="editor-preview"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
