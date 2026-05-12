import type { Doc, DocKind } from "./api";

const MIME: Record<DocKind, string> = {
  md: "text/markdown",
  csv: "text/csv",
};

const EXT: Record<DocKind, string> = {
  md: "md",
  csv: "csv",
};

export function downloadDoc(doc: Doc): void {
  const blob = new Blob([doc.content], { type: MIME[doc.kind] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.slug}.${EXT[doc.kind]}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
