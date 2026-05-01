import type { DocMeta } from "../lib/api";

type Props = {
  docs: DocMeta[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onNew: () => void;
  onDelete: (slug: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function Sidebar({
  docs,
  activeSlug,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  onLogout,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>tinybook</h2>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button className="icon-btn" onClick={onLogout} title="Logout">
            ↩
          </button>
          <button className="icon-btn" onClick={onOpenSettings} title="Settings">
            ⚙
          </button>
        </div>
      </div>
      <button className="primary-btn" onClick={onNew}>
        + New document
      </button>
      <ul className="doc-list">
        {docs.length === 0 && <li className="muted">No documents yet</li>}
        {docs.map((d) => (
          <li
            key={d.slug}
            className={`doc-item ${d.slug === activeSlug ? "active" : ""}`}
          >
            <button className="doc-link" onClick={() => onSelect(d.slug)}>
              <span className="doc-title">{d.title}</span>
              <span className="doc-slug">{d.slug}</span>
            </button>
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
          </li>
        ))}
      </ul>
    </aside>
  );
}
