import { readdir, mkdir, unlink, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reconcile } from "./order";

const DOCS_DIR = resolve(process.cwd(), "data", "docs");

await mkdir(DOCS_DIR, { recursive: true });

export type DocKind = "md" | "csv";
export const DOC_EXTS: Record<DocKind, string> = { md: "md", csv: "csv" };
export const KIND_BY_EXT: Record<string, DocKind> = { md: "md", csv: "csv" };

export type DocMeta = {
  slug: string;
  title: string;
  kind: DocKind;
  updatedAt: number;
};

export type Doc = DocMeta & {
  content: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/i;

function pathFor(slug: string, kind: DocKind): string {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`);
  const p = resolve(DOCS_DIR, `${slug}.${DOC_EXTS[kind]}`);
  if (!p.startsWith(DOCS_DIR + "/") && p !== DOCS_DIR) {
    throw new Error("path escape");
  }
  return p;
}

async function findOnDisk(
  slug: string,
): Promise<{ path: string; kind: DocKind } | null> {
  for (const kind of Object.keys(DOC_EXTS) as DocKind[]) {
    const p = pathFor(slug, kind);
    if (await Bun.file(p).exists()) return { path: p, kind };
  }
  return null;
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `doc-${Date.now()}`;
}

function deriveTitle(
  content: string,
  kind: DocKind,
  fallback: string,
): string {
  if (kind === "md") {
    const m = content.match(/^\s*#\s+(.+?)\s*$/m);
    if (m && m[1]) return m[1];
  }
  return fallback;
}

function defaultBody(kind: DocKind, title: string): string {
  if (kind === "csv") return "title,status,notes\n";
  return `# ${title}\n\n`;
}

export async function listDocs(): Promise<DocMeta[]> {
  const entries = await readdir(DOCS_DIR);
  const out: DocMeta[] = [];
  for (const name of entries) {
    const dot = name.lastIndexOf(".");
    if (dot <= 0) continue;
    const ext = name.slice(dot + 1).toLowerCase();
    const kind = KIND_BY_EXT[ext];
    if (!kind) continue;
    const slug = name.slice(0, dot);
    const full = join(DOCS_DIR, name);
    const st = await stat(full);
    const content = await Bun.file(full).text();
    out.push({
      slug,
      title: deriveTitle(content, kind, slug),
      kind,
      updatedAt: st.mtimeMs,
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  const order = await reconcile(out.map((d) => d.slug));
  if (order.length === 0) return out;
  const byslug = new Map(out.map((d) => [d.slug, d]));
  const ordered: DocMeta[] = [];
  for (const slug of order) {
    const d = byslug.get(slug);
    if (d) {
      ordered.push(d);
      byslug.delete(slug);
    }
  }
  return [...ordered, ...out.filter((d) => byslug.has(d.slug))];
}

export async function readDoc(slug: string): Promise<Doc | null> {
  const found = await findOnDisk(slug);
  if (!found) return null;
  const content = await Bun.file(found.path).text();
  const st = await stat(found.path);
  return {
    slug,
    title: deriveTitle(content, found.kind, slug),
    kind: found.kind,
    updatedAt: st.mtimeMs,
    content,
  };
}

export async function writeDoc(slug: string, content: string): Promise<Doc> {
  const found = await findOnDisk(slug);
  if (!found) throw new Error(`doc not found: ${slug}`);
  await Bun.write(found.path, content);
  const st = await stat(found.path);
  return {
    slug,
    title: deriveTitle(content, found.kind, slug),
    kind: found.kind,
    updatedAt: st.mtimeMs,
    content,
  };
}

export async function createDoc(
  title: string,
  kind: DocKind = "md",
  content?: string,
): Promise<Doc> {
  let slug = slugify(title);
  let n = 1;
  while (await findOnDisk(slug)) {
    slug = `${slugify(title)}-${++n}`;
  }
  const p = pathFor(slug, kind);
  const body = content ?? defaultBody(kind, title);
  await Bun.write(p, body);
  const st = await stat(p);
  return {
    slug,
    title: deriveTitle(body, kind, title),
    kind,
    updatedAt: st.mtimeMs,
    content: body,
  };
}

export async function deleteDoc(slug: string): Promise<boolean> {
  const found = await findOnDisk(slug);
  if (!found) return false;
  await unlink(found.path);
  return true;
}
