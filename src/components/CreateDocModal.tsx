import { useEffect, useRef, useState } from "react";

type NewKind = "md" | "csv" | "kanban";

type Props = {
  open: boolean;
  onClose: () => void;
  onNew: (kind: NewKind) => void;
  onImport: (files: File[]) => Promise<{ skipped: string[] }>;
};

const KINDS: Array<{ kind: NewKind; badge: string; label: string; desc: string }> = [
  { kind: "md", badge: "MD", label: "Markdown", desc: "Notes, drafts, prose" },
  { kind: "csv", badge: "CSV", label: "CSV", desc: "Tabular data" },
  { kind: "kanban", badge: "KB", label: "Kanban", desc: "Cards by status" },
];

export function CreateDocModal({ open, onClose, onNew, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSkipped([]);
  }, [open]);

  if (!open) return null;

  function pick(kind: NewKind) {
    onClose();
    onNew(kind);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setSkipped([]);
    const result = await onImport(Array.from(fileList));
    if (result.skipped.length > 0) {
      setSkipped(result.skipped);
    } else {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>New document</h2>
        <div className="create-tiles">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className="create-tile"
              onClick={() => pick(k.kind)}
            >
              <span className="kind-badge">{k.badge}</span>
              <span className="create-tile-label">{k.label}</span>
              <span className="create-tile-desc muted small">{k.desc}</span>
            </button>
          ))}
        </div>
        <div className="create-import">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Import file(s)…
          </button>
          <span className="muted small">.md, .markdown, .csv</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.csv"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {skipped.length > 0 && (
          <p className="import-error">
            Skipped (unsupported): {skipped.join(", ")}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
