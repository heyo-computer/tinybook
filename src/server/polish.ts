import { readDoc, writeDoc } from "./docs";

const DEFAULT_BASE_URL = "https://api.inceptionlabs.ai/v1";

const POLISH_SYSTEM = `You polish markdown documents. Improve flow and clarity, fix grammar and spelling, dedupe and tighten verbose passages, preserve meaning, headings, lists, links, and code blocks. Return ONLY the revised markdown, no commentary, no preface, no code fences around the whole document.`;

export type PolishRequest = {
  slug: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export async function polishDoc(req: PolishRequest) {
  const doc = await readDoc(req.slug);
  if (!doc) throw new Error(`doc not found: ${req.slug}`);
  if (!doc.content.trim()) return doc;

  const baseUrl = req.baseUrl?.trim() || DEFAULT_BASE_URL;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: POLISH_SYSTEM },
        { role: "user", content: doc.content },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`polish error ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  const polished: string = data.choices?.[0]?.message?.content ?? "";
  if (!polished.trim()) throw new Error("empty polish response");

  return await writeDoc(req.slug, polished);
}
