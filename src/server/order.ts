import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const ORDER_PATH = resolve(process.cwd(), "data", "order.json");

await mkdir(dirname(ORDER_PATH), { recursive: true });

export async function getOrder(): Promise<string[]> {
  const f = Bun.file(ORDER_PATH);
  if (!(await f.exists())) return [];
  try {
    const data = await f.json();
    if (!Array.isArray(data)) return [];
    return data.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

export async function setOrder(slugs: string[]): Promise<void> {
  const seen = new Set<string>();
  const deduped = slugs.filter((s) => {
    if (typeof s !== "string") return false;
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
  await Bun.write(ORDER_PATH, JSON.stringify(deduped, null, 2));
}

export async function reconcile(existingSlugs: string[]): Promise<string[]> {
  const order = await getOrder();
  const set = new Set(existingSlugs);
  const filtered = order.filter((s) => set.has(s));
  if (filtered.length !== order.length) {
    await setOrder(filtered);
  }
  return filtered;
}
