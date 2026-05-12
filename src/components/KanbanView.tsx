import { useMemo, useState } from "react";
import type { CsvData } from "../lib/csv";

type Props = {
  data: CsvData;
  statusIdx: number;
  titleIdx: number;
  readOnly?: boolean;
  onChange: (rows: string[][]) => void;
};

export function KanbanView({
  data,
  statusIdx,
  titleIdx,
  readOnly = false,
  onChange,
}: Props) {
  const [dragRow, setDragRow] = useState<number | null>(null);

  const columns = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of data.rows) {
      const v = (r[statusIdx] ?? "").trim();
      const key = v || "(none)";
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
    if (out.length === 0) out.push("(none)");
    return out;
  }, [data.rows, statusIdx]);

  function setStatus(rowIdx: number, status: string) {
    const next = data.rows.map((r, i) =>
      i === rowIdx
        ? r.map((c, j) => (j === statusIdx ? (status === "(none)" ? "" : status) : c))
        : r,
    );
    onChange(next);
  }

  function setTitle(rowIdx: number, value: string) {
    const next = data.rows.map((r, i) =>
      i === rowIdx ? r.map((c, j) => (j === titleIdx ? value : c)) : r,
    );
    onChange(next);
  }

  function deleteRow(rowIdx: number) {
    onChange(data.rows.filter((_, i) => i !== rowIdx));
  }

  function addCardTo(status: string) {
    const newRow = data.columns.map(() => "");
    newRow[statusIdx] = status === "(none)" ? "" : status;
    onChange([...data.rows, newRow]);
  }

  return (
    <div className="kanban-board">
      {columns.map((col) => {
        const cardIdxs = data.rows
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => {
            const v = (r[statusIdx] ?? "").trim();
            const key = v || "(none)";
            return key === col;
          });
        return (
          <div
            key={col}
            className="kanban-col"
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    if (dragRow !== null) e.preventDefault();
                  }
            }
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (dragRow !== null) {
                      setStatus(dragRow, col);
                      setDragRow(null);
                    }
                  }
            }
          >
            <div className="kanban-col-header">
              <span className="kanban-col-title">{col}</span>
              <span className="kanban-col-count muted small">{cardIdxs.length}</span>
            </div>
            <div className="kanban-cards">
              {cardIdxs.map(({ r, i }) => (
                <div
                  key={i}
                  className={`kanban-card ${dragRow === i ? "dragging" : ""}`}
                  draggable={!readOnly}
                  onDragStart={readOnly ? undefined : () => setDragRow(i)}
                  onDragEnd={readOnly ? undefined : () => setDragRow(null)}
                >
                  <input
                    className="kanban-card-title"
                    value={r[titleIdx] ?? ""}
                    placeholder="(untitled)"
                    readOnly={readOnly}
                    onChange={(e) => setTitle(i, e.target.value)}
                  />
                  <div className="kanban-card-meta">
                    {data.columns.map((c, ci) =>
                      ci === titleIdx || ci === statusIdx ? null : (
                        <div key={ci} className="kanban-card-field">
                          <span className="muted small">{c}</span>
                          <span className="kanban-card-value">{r[ci] ?? ""}</span>
                        </div>
                      ),
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      className="icon-btn delete kanban-card-delete"
                      title="Delete card"
                      onClick={() => deleteRow(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  className="ghost-btn small-btn kanban-add"
                  onClick={() => addCardTo(col)}
                >
                  + Card
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
