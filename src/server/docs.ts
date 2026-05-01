import { readdir, mkdir, unlink, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const DOCS_DIR = resolve(process.cwd(), "data", "docs");

await mkdir(DOCS_DIR, { recursive: true });

export type DocMeta = {
  slug: string;
  title: string;
  updatedAt: number;
};

export type Doc = DocMeta & {
  content: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/i;

function pathFor(slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`);
  const p = resolve(DOCS_DIR, `${slug}.md`);
  if (!p.startsWith(DOCS_DIR + "/") && p !== DOCS_DIR) {
    throw new Error("path escape");
  }
  return p;
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

function deriveTitle(content: string, fallback: string): string {
  const m = content.match(/^\s*#\s+(.+?)\s*$/m);
  if (m && m[1]) return m[1];
  return fallback;
}

export async function listDocs(): Promise<DocMeta[]> {
  const entries = await readdir(DOCS_DIR);
  const out: DocMeta[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const slug = name.slice(0, -3);
    const full = join(DOCS_DIR, name);
    const st = await stat(full);
    const content = await Bun.file(full).text();
    out.push({
      slug,
      title: deriveTitle(content, slug),
      updatedAt: st.mtimeMs,
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export async function readDoc(slug: string): Promise<Doc | null> {
  const p = pathFor(slug);
  const f = Bun.file(p);
  if (!(await f.exists())) return null;
  const content = await f.text();
  const st = await stat(p);
  return {
    slug,
    title: deriveTitle(content, slug),
    updatedAt: st.mtimeMs,
    content,
  };
}

export async function writeDoc(slug: string, content: string): Promise<Doc> {
  const p = pathFor(slug);
  await Bun.write(p, content);
  const st = await stat(p);
  return {
    slug,
    title: deriveTitle(content, slug),
    updatedAt: st.mtimeMs,
    content,
  };
}

export async function createDoc(title: string, content?: string): Promise<Doc> {
  let slug = slugify(title);
  let p = pathFor(slug);
  let n = 1;
  while (await Bun.file(p).exists()) {
    slug = `${slugify(title)}-${++n}`;
    p = pathFor(slug);
  }
  const body = content ?? `# ${title}\n\n`;
  return writeDoc(slug, body);
}

export async function deleteDoc(slug: string): Promise<boolean> {
  const p = pathFor(slug);
  if (!(await Bun.file(p).exists())) return false;
  await unlink(p);
  return true;
}
