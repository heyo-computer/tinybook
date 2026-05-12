export type CsvData = {
  columns: string[];
  rows: string[][];
};

// RFC-4180 parser: handles quoted fields, embedded commas/quotes/newlines.
export function parseCsv(text: string): CsvData {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // flush trailing field/row if any content
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  if (records.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = records[0]!.map((c) => c);
  const width = columns.length;
  const rows = records.slice(1).map((r) => {
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push("");
    return padded;
  });
  return { columns, rows };
}

function escapeField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeCsv(data: CsvData): string {
  const lines: string[] = [];
  lines.push(data.columns.map(escapeField).join(","));
  for (const r of data.rows) {
    const row: string[] = [];
    for (let i = 0; i < data.columns.length; i++) {
      row.push(escapeField(r[i] ?? ""));
    }
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

export function findColumn(
  columns: string[],
  candidates: string[],
): number {
  const lower = columns.map((c) => c.trim().toLowerCase());
  for (const want of candidates) {
    const idx = lower.indexOf(want.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}
