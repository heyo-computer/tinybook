import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "../lib/api";
import { findColumn, parseCsv, serializeCsv, type CsvData } from "../lib/csv";
import { downloadDoc } from "../lib/download";
import { KanbanView } from "./KanbanView";

type Props = {
  doc: Doc;
  readOnly?: boolean;
  onSave: (slug: string, content: string) => Promise<void>;
};

type ViewMode = "table" | "kanban";

function viewKey(slug: string) {
  return `kanbanView:${slug}`;
}

function loadView(slug: string): ViewMode {
  try {
    const v = localStorage.getItem(viewKey(slug));
    if (v === "kanban" || v === "table") return v;
  } catch {}
  return "table";
}

export function CsvEditor({ doc, readOnly = false, onSave }: Props) {
  const [data, setData] = useState<CsvData>(() => parseCsv(doc.content));
  const [savedAt, setSavedAt] = useState<number | null>(doc.updatedAt);
  const [view, setView] = useState<ViewMode>(() => loadView(doc.slug));
  const lastSlug = useRef<string>(doc.slug);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>(doc.content);

  useEffect(() => {
    if (doc.slug !== lastSlug.current) {
      setData(parseCsv(doc.content));
      lastSerialized.current = doc.content;
      lastSlug.current = doc.slug;
      setSavedAt(doc.updatedAt);
      setView(loadView(doc.slug));
    }
  }, [doc]);

  const statusIdx = useMemo(
    () => findColumn(data.columns, ["status"]),
    [data.columns],
  );
  const titleIdx = useMemo(() => {
    const t = findColumn(data.columns, ["title", "name"]);
    if (t !== -1) return t;
    for (let i = 0; i < data.columns.length; i++) {
      if (i !== statusIdx) return i;
    }
    return 0;
  }, [data.columns, statusIdx]);

  const kanbanReady = statusIdx !== -1 && data.columns.length > 0;
  const effectiveView: ViewMode = kanbanReady ? view : "table";

  const serialized = useMemo(() => serializeCsv(data), [data]);

  useEffect(() => {
    if (readOnly) return;
    if (serialized === lastSerialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const slug = doc.slug;
    const body = serialized;
    saveTimer.current = setTimeout(async () => {
      await onSave(slug, body);
      lastSerialized.current = body;
      setSavedAt(Date.now());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [serialized, doc.slug, onSave, readOnly]);

  function chooseView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(viewKey(doc.slug), next);
    } catch {}
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setData((d) => {
      const rows = d.rows.map((r, i) =>
        i === rowIdx ? r.map((c, j) => (j === colIdx ? value : c)) : r,
      );
      return { ...d, rows };
    });
  }

  function updateColumn(colIdx: number, value: string) {
    setData((d) => {
      const columns = d.columns.map((c, i) => (i === colIdx ? value : c));
      return { ...d, columns };
    });
  }

  function addRow() {
    setData((d) => ({
      ...d,
      rows: [...d.rows, d.columns.map(() => "")],
    }));
  }

  function addColumn() {
    setData((d) => ({
      columns: [...d.columns, `col${d.columns.length + 1}`],
      rows: d.rows.map((r) => [...r, ""]),
    }));
  }

  function deleteRow(idx: number) {
    setData((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== idx) }));
  }

  function deleteColumn(idx: number) {
    setData((d) => ({
      columns: d.columns.filter((_, i) => i !== idx),
      rows: d.rows.map((r) => r.filter((_, i) => i !== idx)),
    }));
  }

  function setRows(rows: string[][]) {
    setData((d) => ({ ...d, rows }));
  }

  return (
    <div className="editor csv">
      <div className="editor-toolbar">
        <span className="doc-slug-label">{doc.slug}.csv</span>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${effectiveView === "table" ? "active" : ""}`}
              onClick={() => chooseView("table")}
            >
              Table
            </button>
            <button
              className={`view-toggle-btn ${effectiveView === "kanban" ? "active" : ""}`}
              onClick={() => kanbanReady && chooseView("kanban")}
              disabled={!kanbanReady}
              title={
                kanbanReady
                  ? "Kanban view"
                  : "Add a 'status' column to enable Kanban"
              }
            >
              Kanban
            </button>
          </div>
          {!readOnly && effectiveView === "table" && (
            <>
              <button className="ghost-btn small-btn" onClick={addRow}>
                + Row
              </button>
              <button className="ghost-btn small-btn" onClick={addColumn}>
                + Column
              </button>
            </>
          )}
          <button
            className="ghost-btn small-btn"
            onClick={() => downloadDoc({ ...doc, content: serialized })}
            title="Download"
          >
            ↓ Download
          </button>
          {!readOnly && (
            <span className="muted small">
              {savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : "unsaved"}
            </span>
          )}
        </div>
      </div>
      {effectiveView === "kanban" ? (
        <div className="kanban-scroll">
          <KanbanView
            data={data}
            statusIdx={statusIdx}
            titleIdx={titleIdx}
            readOnly={readOnly}
            onChange={setRows}
          />
        </div>
      ) : (
        <div className="csv-scroll">
          <table className="csv-table">
            <thead>
              <tr>
                {data.columns.map((col, ci) => (
                  <th key={ci}>
                    <div className="csv-th-inner">
                      <input
                        className="csv-input csv-th-input"
                        value={col}
                        readOnly={readOnly}
                        onChange={(e) => updateColumn(ci, e.target.value)}
                      />
                      {!readOnly && (
                        <button
                          className="icon-btn delete"
                          title="Delete column"
                          onClick={() => deleteColumn(ci)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {!readOnly && <th className="csv-th-spacer" />}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={ri}>
                  {data.columns.map((_, ci) => (
                    <td key={ci}>
                      <input
                        className="csv-input"
                        value={row[ci] ?? ""}
                        readOnly={readOnly}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="csv-row-actions">
                      <button
                        className="icon-btn delete"
                        title="Delete row"
                        onClick={() => deleteRow(ri)}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={data.columns.length + (readOnly ? 0 : 1)}
                    className="muted"
                    style={{ padding: "0.6rem" }}
                  >
                    {readOnly ? "No rows." : "No rows. Click + Row to add one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
