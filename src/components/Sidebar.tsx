import { useState } from "react";
import type { DocKind, DocMeta } from "../lib/api";
import { PaperBackdrop } from "./PaperBackdrop";
import { CreateDocModal } from "./CreateDocModal";

type NewKind = "md" | "csv" | "kanban";

type Props = {
  docs: DocMeta[];
  activeSlug: string | null;
  title: string;
  readOnly?: boolean;
  onSelect: (slug: string) => void;
  onNew: (kind: NewKind) => void;
  onImport: (files: File[]) => Promise<{ skipped: string[] }>;
  onDownload: (slug: string) => void;
  onDelete: (slug: string) => void;
  onReorder: (slugs: string[]) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

const KIND_LABEL: Record<DocKind, string> = {
  md: "MD",
  csv: "CSV",
};

export function Sidebar({
  docs,
  activeSlug,
  title,
  readOnly = false,
  onSelect,
  onNew,
  onImport,
  onDownload,
  onDelete,
  onReorder,
  onOpenSettings,
  onLogout,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function handleDrop(targetSlug: string) {
    if (!dragSlug || dragSlug === targetSlug) {
      setDragSlug(null);
      setDropTarget(null);
      return;
    }
    const slugs = docs.map((d) => d.slug);
    const from = slugs.indexOf(dragSlug);
    const to = slugs.indexOf(targetSlug);
    if (from < 0 || to < 0) return;
    slugs.splice(from, 1);
    slugs.splice(to, 0, dragSlug);
    setDragSlug(null);
    setDropTarget(null);
    onReorder(slugs);
  }

  return (
    <aside className="sidebar">
      <PaperBackdrop />
      <div className="sidebar-header">
        <h2>{title}</h2>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {!readOnly && (
            <button
              className="icon-btn"
              onClick={() => setCreateOpen(true)}
              title="New document"
            >
              +
            </button>
          )}
          <button className="icon-btn" onClick={onLogout} title="Logout">
            ↩
          </button>
          {!readOnly && (
            <button
              className="icon-btn"
              onClick={onOpenSettings}
              title="Settings"
            >
              ⚙
            </button>
          )}
        </div>
      </div>
      <ul className="doc-list">
        {docs.length === 0 && <li className="muted">No documents yet</li>}
        {docs.map((d) => (
          <li
            key={d.slug}
            className={`doc-item ${d.slug === activeSlug ? "active" : ""} ${
              dragSlug === d.slug ? "dragging" : ""
            } ${dropTarget === d.slug ? "drop-target" : ""}`}
            draggable={!readOnly}
            onDragStart={
              readOnly
                ? undefined
                : (e) => {
                    setDragSlug(d.slug);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", d.slug);
                  }
            }
            onDragEnd={
              readOnly
                ? undefined
                : () => {
                    setDragSlug(null);
                    setDropTarget(null);
                  }
            }
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    if (!dragSlug || dragSlug === d.slug) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropTarget !== d.slug) setDropTarget(d.slug);
                  }
            }
            onDragLeave={
              readOnly
                ? undefined
                : () => {
                    if (dropTarget === d.slug) setDropTarget(null);
                  }
            }
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
                    handleDrop(d.slug);
                  }
            }
          >
            <button className="doc-link" onClick={() => onSelect(d.slug)}>
              <span className="doc-title">{d.title}</span>
              <span className="doc-meta">
                <span className="kind-badge small">{KIND_LABEL[d.kind]}</span>
                <span className="doc-slug">{d.slug}</span>
              </span>
            </button>
            <button
              className="icon-btn download"
              title="Download"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(d.slug);
              }}
            >
              ↓
            </button>
            {!readOnly && (
              <button
                className="icon-btn delete"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${d.title}"?`)) onDelete(d.slug);
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <CreateDocModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onNew={onNew}
        onImport={onImport}
      />
    </aside>
  );
}
